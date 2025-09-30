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
    '2025-09-28',
    '2025-09-29',
    '2025-09-30'
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    populateDateSelector();
    setupEventListeners();
    loadAllTimeRecords();
    loadDailyComparison();
});

function populateDateSelector() {
    const datePills = document.getElementById('datePills');

    availableDates.forEach(dateStr => {
        const pill = document.createElement('button');
        pill.className = 'date-pill';
        pill.dataset.date = dateStr;

        const [year, month, day] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const displayDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });

        pill.textContent = displayDate;
        datePills.appendChild(pill);
    });

    // Auto-select the most recent date
    if (availableDates.length > 0) {
        const latestDate = availableDates[availableDates.length - 1];
        setActiveDatePill(latestDate);
        loadDataForDate(latestDate);
    }
}

function setActiveDatePill(dateStr) {
    // Remove active class from all pills
    document.querySelectorAll('.date-pill').forEach(pill => {
        pill.classList.remove('active');
    });

    // Add active class to selected pill
    const activePill = document.querySelector(`[data-date="${dateStr}"]`);
    if (activePill) {
        activePill.classList.add('active');
    }
}

function setupEventListeners() {
    // Date pill selection
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('date-pill')) {
            const selectedDate = e.target.dataset.date;
            if (selectedDate) {
                setActiveDatePill(selectedDate);
                loadDataForDate(selectedDate);
            }
        }

        // Segment tabs
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
    const fastestSegment1DetailsEl = document.getElementById('fastestSegment1Details');
    const fastestSegment2El = document.getElementById('fastestSegment2');
    const fastestSegment2DetailsEl = document.getElementById('fastestSegment2Details');
    const fastestSegment3El = document.getElementById('fastestSegment3');
    const fastestSegment3DetailsEl = document.getElementById('fastestSegment3Details');

    if (fastest) {
        fastestOverallEl.textContent = formatTime(fastest.totalTime);
        fastestOverallDetailsEl.textContent = `Racer ${fastest.competitor} • ${formatDate(fastest.date)}`;
    }

    if (segment1) {
        fastestSegment1El.textContent = formatTime(segment1.time);
        fastestSegment1DetailsEl.textContent = `Racer ${segment1.competitor} • ${formatDate(segment1.date)}`;
    }

    if (segment2) {
        fastestSegment2El.textContent = formatTime(segment2.time);
        fastestSegment2DetailsEl.textContent = `Racer ${segment2.competitor} • ${formatDate(segment2.date)}`;
    }

    if (segment3) {
        fastestSegment3El.textContent = formatTime(segment3.time);
        fastestSegment3DetailsEl.textContent = `Racer ${segment3.competitor} • ${formatDate(segment3.date)}`;
    }
}

function updateDisplayDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const displayDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('displayDate').textContent = displayDate;
}

function populateHourGrid() {
    if (Object.keys(allRaceData).length === 0) {
        return;
    }

    // Automatically display the race results
    displayRaceResults(10);
}

function displayRaceResults(hour) {
    const raceData = allRaceData[hour];
    if (!raceData) return;

    const raceResults = document.getElementById('raceResults');

    // Show race results
    raceResults.style.display = 'block';
    raceResults.scrollIntoView({ behavior: 'smooth' });

    // Update podium
    updatePodium(raceData.slice(0, 3));

    // Reset and update segment analysis (default to total time)
    resetSegmentTabs();
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

            nameEl.textContent = `Racer ${competitor.competitor}`;
            timeEl.textContent = formatTime(competitor.totalTime);

            positionEl.style.opacity = '1';
        } else {
            positionEl.style.opacity = '0.3';
            positionEl.querySelector('.competitor-name').textContent = '--';
            positionEl.querySelector('.competitor-time').textContent = '--';
        }
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
            <div class="competitor">Racer ${competitor.competitor}</div>
            <div class="time">${formatTime(competitorTime)}</div>
            <div class="gap">${gap}</div>
        `;

        segmentResults.appendChild(row);
    });
}

function resetSegmentTabs() {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.remove('active');
    });

    // Add active class to the "Total Time" tab
    const totalTimeTab = document.querySelector('[data-segment="total"]');
    if (totalTimeTab) {
        totalTimeTab.classList.add('active');
    }
}

function getCurrentRaceData() {
    // Since we only have one daily race at hour 10, always return that data
    return allRaceData[10] || null;
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
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

async function loadDailyComparison() {
    const dailyComparisonGrid = document.getElementById('dailyComparisonGrid');
    const dailyData = [];

    // Track best segment times across all days
    let bestSegmentTimes = {
        segment1: { time: Infinity, date: null, competitor: null },
        segment2: { time: Infinity, date: null, competitor: null },
        segment3: { time: Infinity, date: null, competitor: null }
    };

    // Load data for all available dates
    for (const dateStr of availableDates) {
        try {
            const response = await fetch(`data/tracks-${dateStr}.json`);
            if (response.ok) {
                const data = await response.json();
                const races = processRaceData(data.tracks);
                const dayData = races[10]; // Get the daily race data

                if (dayData && dayData.length > 0) {
                    // Get top 3 times for this day
                    const topThree = dayData.slice(0, 3);
                    const winnerTime = topThree[0].totalTime;

                    // Check all competitors for best segment times
                    dayData.forEach(competitor => {
                        if (competitor.segments && competitor.segments.length >= 3) {
                            // Check segment 1 (N.Virginia → London)
                            if (competitor.segments[0].microseconds < bestSegmentTimes.segment1.time) {
                                bestSegmentTimes.segment1 = {
                                    time: competitor.segments[0].microseconds,
                                    date: dateStr,
                                    competitor: competitor.competitor
                                };
                            }
                            // Check segment 2 (London → Tokyo)
                            if (competitor.segments[1].microseconds < bestSegmentTimes.segment2.time) {
                                bestSegmentTimes.segment2 = {
                                    time: competitor.segments[1].microseconds,
                                    date: dateStr,
                                    competitor: competitor.competitor
                                };
                            }
                            // Check segment 3 (Tokyo → N.Virginia)
                            if (competitor.segments[2].microseconds < bestSegmentTimes.segment3.time) {
                                bestSegmentTimes.segment3 = {
                                    time: competitor.segments[2].microseconds,
                                    date: dateStr,
                                    competitor: competitor.competitor
                                };
                            }
                        }
                    });

                    dailyData.push({
                        date: dateStr,
                        topThree: topThree,
                        winnerTime: winnerTime,
                        formattedDate: formatDateForComparison(dateStr)
                    });
                }
            }
        } catch (error) {
            console.error(`Error loading comparison data for ${dateStr}:`, error);
        }
    }

    // Sort by winner time to identify best day
    dailyData.sort((a, b) => a.winnerTime - b.winnerTime);
    const bestDayTime = dailyData[0]?.winnerTime;

    // Clear and populate the grid
    dailyComparisonGrid.innerHTML = '';

    dailyData.forEach(dayData => {
        const isBestDay = dayData.winnerTime === bestDayTime;
        const card = createDailyCard(dayData, isBestDay, bestSegmentTimes);
        dailyComparisonGrid.appendChild(card);
    });
}

function formatDateForComparison(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return {
        short: date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        }),
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' })
    };
}

function createDailyCard(dayData, isBestDay, bestSegmentTimes) {
    const card = document.createElement('div');
    card.className = `daily-card ${isBestDay ? 'best-day' : ''}`;

    const medals = ['🥇', '🥈', '🥉'];

    // Create podium positions with segment highlighting
    const podiumHTML = dayData.topThree.map((competitor, index) => {
        let segmentHighlights = '';

        // Check if this competitor has any best segment times
        if (competitor.segments && competitor.segments.length >= 3) {
            const hasBestSeg1 = bestSegmentTimes.segment1.date === dayData.date &&
                               bestSegmentTimes.segment1.competitor === competitor.competitor;
            const hasBestSeg2 = bestSegmentTimes.segment2.date === dayData.date &&
                               bestSegmentTimes.segment2.competitor === competitor.competitor;
            const hasBestSeg3 = bestSegmentTimes.segment3.date === dayData.date &&
                               bestSegmentTimes.segment3.competitor === competitor.competitor;

            if (hasBestSeg1 || hasBestSeg2 || hasBestSeg3) {
                const segments = [];
                if (hasBestSeg1) segments.push('N.VA→LON');
                if (hasBestSeg2) segments.push('LON→TYO');
                if (hasBestSeg3) segments.push('TYO→N.VA');
                segmentHighlights = `<div class="segment-highlights">🟢 Best: ${segments.join(', ')}</div>`;
            }
        }

        return `
            <div class="daily-position">
                <div class="daily-medal">${medals[index]}</div>
                <div class="daily-competitor">
                    Racer ${competitor.competitor}
                    ${segmentHighlights}
                </div>
                <div class="daily-time">${formatTime(competitor.totalTime)}</div>
            </div>
        `;
    }).join('');

    card.innerHTML = `
        <div class="daily-card-header">
            <div class="daily-card-date">${dayData.formattedDate.short}</div>
            <div class="daily-card-rank">${isBestDay ? '🏆 Best Overall Day' : dayData.formattedDate.dayOfWeek}</div>
        </div>
        <div class="daily-podium">
            ${podiumHTML}
        </div>
    `;

    return card;
}