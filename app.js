// Global variables
let allRaceData = {};
let currentDate = '';
let allTimeRecords = {
    fastest: null,
    fastestSegment1: null,
    fastestSegment2: null,
    fastestSegment3: null
};

// Available dates (based on actual data files)
const availableDates = [
    '2025-09-23',
    '2025-09-24',
    '2025-09-25',
    '2025-09-26',
    '2025-09-27',
    '2025-09-28'
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    populateDateSelector();
    setupEventListeners();
    loadAllTimeRecords();
});

function populateDateSelector() {
    const dateSelect = document.getElementById('dateSelect');

    availableDates.forEach(dateStr => {
        const option = document.createElement('option');
        option.value = dateStr;

        const date = new Date(dateStr + 'T00:00:00Z');
        const displayDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        option.textContent = displayDate;
        dateSelect.appendChild(option);
    });

    // Auto-select the most recent date
    if (availableDates.length > 0) {
        const latestDate = availableDates[availableDates.length - 1];
        dateSelect.value = latestDate;
        loadDataForDate(latestDate);
    }
}

function setupEventListeners() {
    // Date selection
    document.getElementById('dateSelect').addEventListener('change', function(e) {
        const selectedDate = e.target.value;
        if (selectedDate) {
            loadDataForDate(selectedDate);
        }
    });

    // Segment tabs
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('tab-btn')) {
            // Remove active class from all tabs
            document.querySelectorAll('.tab-btn').forEach(tab => {
                tab.classList.remove('active');
            });
            // Add active class to clicked tab
            e.target.classList.add('active');

            const segment = e.target.dataset.segment;
            displaySegmentAnalysis(segment);
        }

    });
}

async function loadDataForDate(dateStr) {
    currentDate = dateStr;

    try {
        // Update display date
        updateDisplayDate(dateStr);

        // Load race data for selected date
        const response = await fetch(`data/tracks-${dateStr}.json`);
        if (response.ok) {
            const dailyData = await response.json();
            allRaceData = processRaceData(dailyData.tracks);
            console.log(`Loaded races for ${dateStr}:`, Object.keys(allRaceData).length, 'races');

            populateHourGrid();
            hideRaceResults();
        } else {
            console.error('Failed to load data for date:', dateStr);
            allRaceData = {};
            populateHourGrid();
            hideRaceResults();
        }
    } catch (error) {
        console.error('Error loading data:', error);
        allRaceData = {};
        populateHourGrid();
        hideRaceResults();
    }
}

function processRaceData(tracks) {
    // Process all tracks as a single daily race (10 AM race)
    const dailyRace = [];

    Object.values(tracks).forEach(track => {
        // Extract competitor number from UUID (last digit after final dash)
        const uuid = track.uuid || track.baseUuid;
        const competitorMatch = uuid.match(/-(\d+)$/);
        const competitorNumber = competitorMatch ? parseInt(competitorMatch[1]) : 1;

        // Calculate timings
        const timingDetails = calculateMicroseconds(track.journey || track.waypoints);

        dailyRace.push({
            competitor: competitorNumber,
            uuid: uuid,
            trackNumber: track.trackNumber,
            timingDetails: timingDetails,
            totalTime: timingDetails.totalTime,
            segments: timingDetails.segments
        });
    });

    // Sort by total time (fastest first)
    dailyRace.sort((a, b) => a.totalTime - b.totalTime);

    // Return single race structure
    return { 10: dailyRace }; // Always use hour 10 for the single daily race
}

function calculateMicroseconds(waypoints) {
    const details = {
        totalTime: 0,
        segments: [],
        waypoints: []
    };

    if (!waypoints || waypoints.length < 2) return details;

    // Sort waypoints by datetime
    const sortedWaypoints = waypoints.slice().sort((a, b) =>
        new Date(a.datetime) - new Date(b.datetime)
    );

    details.waypoints = sortedWaypoints;

    // Calculate segments between consecutive waypoints
    for (let i = 0; i < sortedWaypoints.length - 1; i++) {
        const start = new Date(sortedWaypoints[i].datetime);
        const end = new Date(sortedWaypoints[i + 1].datetime);
        const timeDiff = (end - start) * 1000; // Convert to microseconds

        details.segments.push({
            from: sortedWaypoints[i].source,
            to: sortedWaypoints[i + 1].source,
            microseconds: timeDiff,
            startTime: sortedWaypoints[i].datetime,
            endTime: sortedWaypoints[i + 1].datetime
        });
    }

    // Calculate total time
    if (sortedWaypoints.length >= 2) {
        const totalStart = new Date(sortedWaypoints[0].datetime);
        const totalEnd = new Date(sortedWaypoints[sortedWaypoints.length - 1].datetime);
        details.totalTime = (totalEnd - totalStart) * 1000;
    }

    return details;
}

async function loadAllTimeRecords() {
    let fastestOverall = null;
    let fastestSegment1 = null;
    let fastestSegment2 = null;
    let fastestSegment3 = null;

    // Load and process all available dates
    for (const dateStr of availableDates) {
        try {
            const response = await fetch(`data/tracks-${dateStr}.json`);
            if (response.ok) {
                const dailyData = await response.json();
                const races = processRaceData(dailyData.tracks);

                // Check all races for records
                Object.values(races).forEach(race => {
                    race.forEach(competitor => {
                        // Overall fastest
                        if (!fastestOverall || competitor.totalTime < fastestOverall.totalTime) {
                            fastestOverall = {
                                ...competitor,
                                date: dateStr
                            };
                        }

                        // Segment records
                        competitor.segments.forEach((segment, index) => {
                            if (index === 0 && (!fastestSegment1 || segment.microseconds < fastestSegment1.time)) {
                                fastestSegment1 = {
                                    time: segment.microseconds,
                                    competitor: competitor.competitor,
                                    date: dateStr
                                };
                            }
                            if (index === 1 && (!fastestSegment2 || segment.microseconds < fastestSegment2.time)) {
                                fastestSegment2 = {
                                    time: segment.microseconds,
                                    competitor: competitor.competitor,
                                    date: dateStr
                                };
                            }
                            if (index === 2 && (!fastestSegment3 || segment.microseconds < fastestSegment3.time)) {
                                fastestSegment3 = {
                                    time: segment.microseconds,
                                    competitor: competitor.competitor,
                                    date: dateStr
                                };
                            }
                        });
                    });
                });
            }
        } catch (error) {
            console.error(`Error loading data for ${dateStr}:`, error);
        }
    }

    // Update display
    updateAllTimeRecords(fastestOverall, fastestSegment1, fastestSegment2, fastestSegment3);
}

function updateAllTimeRecords(fastest, segment1, segment2, segment3) {
    const fastestOverallEl = document.getElementById('fastestOverall');
    const fastestOverallDetailsEl = document.getElementById('fastestOverallDetails');
    const fastestSegment1El = document.getElementById('fastestSegment1');
    const fastestSegment2El = document.getElementById('fastestSegment2');
    const fastestSegment3El = document.getElementById('fastestSegment3');

    if (fastest) {
        fastestOverallEl.textContent = formatTime(fastest.totalTime);
        fastestOverallDetailsEl.textContent = `Competitor ${fastest.competitor} • ${formatDate(fastest.date)}`;
    }

    if (segment1) {
        fastestSegment1El.textContent = formatTime(segment1.time);
    }

    if (segment2) {
        fastestSegment2El.textContent = formatTime(segment2.time);
    }

    if (segment3) {
        fastestSegment3El.textContent = formatTime(segment3.time);
    }
}

function updateDisplayDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00Z');
    const displayDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('displayDate').textContent = displayDate;
}

function populateHourGrid() {
    const hourGrid = document.getElementById('hourGrid');

    if (Object.keys(allRaceData).length === 0) {
        hourGrid.innerHTML = '<p class="loading">No race available for this date</p>';
        return;
    }

    // Hide the hour grid since we're showing results directly
    hourGrid.innerHTML = '';

    // Automatically display the race results
    displayRaceResults(10);
}

function displayRaceResults(hour) {
    const raceData = allRaceData[hour];
    if (!raceData) return;

    const raceResults = document.getElementById('raceResults');
    const raceTitle = document.getElementById('raceTitle');

    // Update race title
    const timeStr = hour <= 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
    if (hour === 12) timeStr = '12:00 PM';
    raceTitle.textContent = `${timeStr} Race Results`;

    // Show race results
    raceResults.style.display = 'block';
    raceResults.scrollIntoView({ behavior: 'smooth' });

    // Update podium
    updatePodium(raceData.slice(0, 3));

    // Update leaderboard
    updateLeaderboard(raceData);

    // Update segment analysis (default to total time)
    displaySegmentAnalysis('total', raceData);
}

function updatePodium(topThree) {
    const positions = ['first', 'second', 'third'];

    positions.forEach((position, index) => {
        const positionEl = document.getElementById(`position${index + 1}`);
        const competitor = topThree[index];

        if (competitor) {
            const nameEl = positionEl.querySelector('.competitor-name');
            const timeEl = positionEl.querySelector('.competitor-time');

            nameEl.textContent = `Competitor ${competitor.competitor}`;
            timeEl.textContent = formatTime(competitor.totalTime);

            positionEl.style.opacity = '1';
        } else {
            positionEl.style.opacity = '0.3';
            positionEl.querySelector('.competitor-name').textContent = '--';
            positionEl.querySelector('.competitor-time').textContent = '--';
        }
    });
}

function updateLeaderboard(raceData) {
    const leaderboardTable = document.getElementById('leaderboardTable');
    leaderboardTable.innerHTML = '';

    const winner = raceData[0];

    raceData.forEach((competitor, index) => {
        const row = document.createElement('div');
        row.className = `leaderboard-row ${index < 3 ? 'top3' : ''}`;

        const gap = index === 0 ? '--' : `+${formatTime(competitor.totalTime - winner.totalTime)}`;

        row.innerHTML = `
            <div class="position">${index + 1}</div>
            <div class="competitor">Competitor ${competitor.competitor}</div>
            <div class="time">${formatTime(competitor.totalTime)}</div>
            <div class="gap">${gap}</div>
        `;

        leaderboardTable.appendChild(row);
    });
}

function displaySegmentAnalysis(segment, raceData = null) {
    const currentRace = raceData || getCurrentRaceData();
    if (!currentRace) return;

    const segmentResults = document.getElementById('segmentResults');
    segmentResults.innerHTML = '';

    let sortedData = [...currentRace];

    if (segment === 'total') {
        // Already sorted by total time
    } else {
        const segmentIndex = parseInt(segment.replace('segment', '')) - 1;
        sortedData.sort((a, b) => {
            const aTime = a.segments[segmentIndex]?.microseconds || Infinity;
            const bTime = b.segments[segmentIndex]?.microseconds || Infinity;
            return aTime - bTime;
        });
    }

    const winner = sortedData[0];
    const winningTime = segment === 'total'
        ? winner.totalTime
        : winner.segments[parseInt(segment.replace('segment', '')) - 1]?.microseconds || 0;

    sortedData.forEach((competitor, index) => {
        const row = document.createElement('div');
        row.className = `leaderboard-row ${index < 3 ? 'top3' : ''}`;

        let competitorTime, gap;
        if (segment === 'total') {
            competitorTime = competitor.totalTime;
        } else {
            const segmentIndex = parseInt(segment.replace('segment', '')) - 1;
            competitorTime = competitor.segments[segmentIndex]?.microseconds || 0;
        }

        gap = index === 0 ? '--' : `+${formatTime(competitorTime - winningTime)}`;

        row.innerHTML = `
            <div class="position">${index + 1}</div>
            <div class="competitor">Competitor ${competitor.competitor}</div>
            <div class="time">${formatTime(competitorTime)}</div>
            <div class="gap">${gap}</div>
        `;

        segmentResults.appendChild(row);
    });
}

function getCurrentRaceData() {
    const activeHour = document.querySelector('.hour-button.active');
    if (activeHour) {
        const hour = parseInt(activeHour.dataset.hour);
        return allRaceData[hour];
    }
    return null;
}

function hideRaceResults() {
    document.getElementById('raceResults').style.display = 'none';
    // Remove active states
    document.querySelectorAll('.hour-button').forEach(btn => {
        btn.classList.remove('active');
    });
}

function formatTime(microseconds) {
    if (!microseconds || microseconds <= 0) return '--';

    return microseconds.toLocaleString() + ' μs';
}

function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00Z');
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}