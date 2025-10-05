const drivers2025 = [
    { name: 'Max Verstappen', team: 'Red Bull', number: 1 },
    { name: 'Yuki Tsunoda', team: 'Red Bull', number: 22 },
    { name: 'Lewis Hamilton', team: 'Ferrari', number: 44 },
    { name: 'Charles Leclerc', team: 'Ferrari', number: 16 },
    { name: 'Lando Norris', team: 'McLaren', number: 4 },
    { name: 'Oscar Piastri', team: 'McLaren', number: 81 },
    { name: 'George Russell', team: 'Mercedes', number: 63 },
    { name: 'Kimi Antonelli', team: 'Mercedes', number: 12 },
    { name: 'Fernando Alonso', team: 'Aston Martin', number: 14 },
    { name: 'Lance Stroll', team: 'Aston Martin', number: 18 },
    { name: 'Pierre Gasly', team: 'Alpine', number: 10 },
    { name: 'Franco Colapinto', team: 'Alpine', number: 45 },
    { name: 'Esteban Ocon', team: 'Haas', number: 31 },
    { name: 'Oliver Bearman', team: 'Haas', number: 87 },
    { name: 'Alex Albon', team: 'Williams', number: 23 },
    { name: 'Carlos Sainz', team: 'Williams', number: 55 },
    { name: 'Liam Lawson', team: 'Racing Bulls', number: 30 },
    { name: 'Isack Hadjar', team: 'Racing Bulls', number: 6 },
    { name: 'Nico Hulkenberg', team: 'Sauber', number: 27 },
    { name: 'Gabriel Bortoleto', team: 'Sauber', number: 5 }
];

const defaultPrompts = {
    raceContext: `Provide race weekend context for the {circuit} Grand Prix on {raceDate} in {season}. Include:
- Weather forecast (temperature, rain probability, wind)
- Track characteristics and key corners
- Historical safety car statistics at this circuit
- Strategy considerations (tire compounds, pit stop windows)
- Recent race history at this circuit (last 3 years)
- Any unique challenges this circuit presents

Keep it concise and factual. Return the response as JSON.`,

    driverPreview: `Write a "what to look for with {driverName}" text for the upcoming F1 {circuit} GP.

Driver: {driverName} (#{driverNumber})
Team: {team}

Race Context:
{raceContext}

Consider:
- Current form and recent results this season (last 5 races)
- Previous performance at this circuit (if applicable)
- Car setup considerations for this track
- Stakes (championship position, career implications, contract situation)
- Driver strengths and weaknesses relevant to this circuit
- What would be a good/perfect result (qualifying and race)

Provide two versions:
1. TLDR: 2-3 sentences max, punchy and informative
2. FULL: Comprehensive analysis with multiple sections (300-400 words). Use markdown formatting with:
   - ## headers for main sections
   - Bullet points for lists
   - **bold** for emphasis
   Include sections on:
   - Current form and momentum
   - Circuit-specific strengths/challenges
   - Championship/career context and stakes
   - Key battles to watch (teammates, rivals)
   - What success looks like this weekend

Format as JSON:
{
  "tldr": "...",
  "full": "...",
  "perfect_quali": "P1-P3",
  "perfect_race": "Podium finish",
  "good_quali": "P4-P6",
  "good_race": "Points finish",
  "stakes_level": "high/medium/low",
  "key_strengths": ["strength1", "strength2"],
  "watch_for": "specific thing to watch"
}`,

    top5: `Based on these driver previews and race context, identify the TOP 5 DRIVERS TO WATCH for this race weekend.

Consider:
- Championship stakes (title fight, team battles)
- Pressure situations (contract year, recent struggles/success)
- Current form (hot streak, redemption arc)
- Track-specific advantages (historical performance, driving style match)
- Storylines (rivalries, milestones, team dynamics)

For each driver, provide:
- Driver name
- Position in ranking (1-5)
- 1-2 sentence abstract explaining why they're must-watch
- Link reference to full preview

Return as JSON array:
[
  {
    "rank": 1,
    "driver": "Driver Name",
    "reason": "Compelling 1-2 sentence explanation",
    "stakes": "What's on the line"
  }
]`,

    underdogs: `Identify 3 UNDERDOG STORIES for this race weekend.

An underdog story should feature drivers who:
- Could surprise with performance above expectations
- Have something significant to prove
- Face adversity or a unique opportunity
- Are flying under the radar but could shine
- Have track-specific advantages not widely recognized

For each underdog, provide:
- Driver name
- Story title (catchy, 5-7 words)
- Story description (2-3 sentences explaining the narrative)
- Why they could surprise

Return as JSON array:
[
  {
    "driver": "Driver Name",
    "title": "Catchy story title",
    "story": "2-3 sentence narrative",
    "surprise_factor": "Why they could overperform"
  }
]`
};

function createEmptyGeneratedData() {
    return {
        drivers: {},
        top5: [],
        underdogs: [],
        raceContext: '',
        metadata: {
            circuit: '',
            date: '',
            season: '',
            generatedAt: null
        }
    };
}

var generatedData = createEmptyGeneratedData();

// F1 API for schedule data
async function fetchRaceSchedule(circuit, season, raceDate) {
    try {
        // Fetch current season races
        const response = await fetch('https://f1api.dev/api/current');
        const data = await response.json();

        // Find the race matching our date or circuit
        const race = data.races?.find(r =>
            r.schedule?.race?.date === raceDate ||
            r.raceName?.toLowerCase().includes(circuit.toLowerCase()) ||
            r.circuit?.circuitName?.toLowerCase().includes(circuit.toLowerCase())
        );

        if (race && race.schedule) {
            const scheduleContainer = document.getElementById('race-schedule');

            // Convert UTC times to CEST/CET
            const formatDateTime = (dateStr, timeStr) => {
                if (!dateStr) return null;
                const dateTimeStr = timeStr ? `${dateStr}T${timeStr}` : dateStr;
                const date = new Date(dateTimeStr);
                const options = {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: timeStr ? '2-digit' : undefined,
                    minute: timeStr ? '2-digit' : undefined,
                    timeZone: 'Europe/Berlin',
                    timeZoneName: 'short'
                };
                return date.toLocaleString('en-US', options);
            };

            const sessions = [
                { name: 'FP1', date: race.schedule.fp1?.date, time: race.schedule.fp1?.time },
                { name: 'FP2', date: race.schedule.fp2?.date, time: race.schedule.fp2?.time },
                { name: 'FP3', date: race.schedule.fp3?.date, time: race.schedule.fp3?.time },
                { name: 'Sprint', date: race.schedule.sprintRace?.date, time: race.schedule.sprintRace?.time },
                { name: 'Qualifying', date: race.schedule.qualy?.date, time: race.schedule.qualy?.time },
                { name: 'Race', date: race.schedule.race?.date, time: race.schedule.race?.time }
            ].filter(s => s.date); // Only show sessions that have dates

            scheduleContainer.innerHTML = sessions.map(s => `
                <div style="background: rgba(255,255,255,0.05); padding: 0.5rem; border-radius: 8px; border-left: 3px solid #e10600;">
                    <div style="color: #e10600; font-weight: 600; margin-bottom: 0.25rem;">${s.name}</div>
                    <div style="color: #ccc; font-size: 0.85rem;">${formatDateTime(s.date, s.time) || s.date}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to fetch race schedule:', error);
    }
}

// F1 API for results data
const f1API = {
    async getCurrentSeason() {
        const response = await fetch('https://f1api.dev/api/current');
        return await response.json();
    },

    async getRaceResults(season, round) {
        const response = await fetch(`https://f1api.dev/api/${season}/${round}/race`);
        return await response.json();
    },

    async getQualifyingResults(season, round) {
        const response = await fetch(`https://f1api.dev/api/${season}/${round}/qualy`);
        return await response.json();
    },

    async getDriverResults(driverNumber, season = 2025) {
        try {
            // Get current season to find latest round
            const currentData = await this.getCurrentSeason();
            const races = currentData.races || [];

            // Find completed races (those with winners)
            const completedRaces = races.filter(r => r.winner !== null);
            const latestRound = completedRaces.length > 0 ? Math.max(...completedRaces.map(r => parseInt(r.round))) : 0;

            // Get last 6 rounds of data
            const rounds = [];
            for (let i = Math.max(1, latestRound - 5); i <= latestRound; i++) {
                rounds.push(i);
            }

            // Fetch race and qualifying results for each round
            const results = {
                qualifying: [],
                race: []
            };

            for (const round of rounds) {
                try {
                    // Fetch race results
                    const raceData = await this.getRaceResults(season, round);
                    const raceResult = raceData.races?.results?.find(r => r.driver?.number === driverNumber);

                    if (raceResult) {
                        const circuit = races.find(r => parseInt(r.round) === round);
                        results.race.push({
                            circuit: circuit?.circuit?.circuitName || `Round ${round}`,
                            position: raceResult.position === 'NC' ? null : parseInt(raceResult.position),
                            dnf: raceResult.position === 'NC' || raceResult.retired !== null,
                            dns: false,
                            date: circuit?.date,
                            round: round
                        });
                    }

                    // Fetch qualifying results
                    const qualiData = await this.getQualifyingResults(season, round);
                    const qualiResult = qualiData.races?.qualyResults?.find(r => r.driver?.number === driverNumber);

                    if (qualiResult) {
                        const circuit = races.find(r => parseInt(r.round) === round);
                        results.qualifying.push({
                            circuit: circuit?.circuit?.circuitName || `Round ${round}`,
                            position: parseInt(qualiResult.gridPosition),
                            dnf: false,
                            dns: qualiResult.gridPosition === '-',
                            date: circuit?.date,
                            round: round
                        });
                    }
                } catch (error) {
                    console.error(`Failed to fetch results for round ${round}:`, error);
                }
            }

            return results;
        } catch (error) {
            console.error('Failed to fetch driver results:', error);
            return { qualifying: [], race: [] };
        }
    }
};

// OpenF1 API Integration (kept for backward compatibility)
const openF1API = {
    baseURL: 'https://api.openf1.org/v1',

    async getLatestSession(sessionType = 'Race') {
        const response = await fetch(`${this.baseURL}/sessions?session_type=${sessionType}&year=2025`);
        const sessions = await response.json();
        return sessions[sessions.length - 1]; // Get most recent
    },

    async getDriverStandings(driverNumber, year = 2025) {
        // Get all race sessions for the year
        const response = await fetch(`${this.baseURL}/sessions?session_type=Race&year=${year}`);
        const sessions = await response.json();

        // Get results for each session
        const results = [];
        for (const session of sessions.slice(-10)) { // Last 10 races
            const resResponse = await fetch(`${this.baseURL}/position?session_key=${session.session_key}&driver_number=${driverNumber}`);
            const positions = await resResponse.json();
            if (positions.length > 0) {
                const finalPosition = positions[positions.length - 1];
                results.push({
                    circuit: session.circuit_short_name,
                    position: finalPosition.position,
                    date: session.date_start
                });
            }
        }
        return results;
    },

    async getSessionResults(driverNumber, sessionType, year = 2025) {
        const response = await fetch(`${this.baseURL}/sessions?session_type=${sessionType}&year=${year}`);
        const sessions = await response.json();

        const results = [];
        for (const session of sessions.slice(-15)) {
            const resResponse = await fetch(`${this.baseURL}/session_result?session_key=${session.session_key}&driver_number=${driverNumber}`);
            const result = await resResponse.json();
            if (result.length > 0) {
                results.push({
                    circuit: session.circuit_short_name,
                    position: result[0].position,
                    date: session.date_start,
                    dnf: result[0].dnf,
                    dns: result[0].dns,
                    sessionType: sessionType
                });
            }
        }
        // Sort by date to ensure chronological order
        return results.sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    async getQualifyingResults(driverNumber, year = 2025) {
        return this.getSessionResults(driverNumber, 'Qualifying', year);
    },

    async getRaceResults(driverNumber, year = 2025) {
        return this.getSessionResults(driverNumber, 'Race', year);
    },

    async getSprintResults(driverNumber, year = 2025) {
        return this.getSessionResults(driverNumber, 'Sprint', year);
    },

    async getSprintQualifyingResults(driverNumber, year = 2025) {
        return this.getSessionResults(driverNumber, 'Sprint Qualifying', year);
    },

    async getStartingGrid(sessionKey) {
        const response = await fetch(`${this.baseURL}/starting_grid?session_key=${sessionKey}`);
        return await response.json();
    }
};

// Initialize
async function init() {
    // Try to load pre-generated preview data
    await loadPreviewData();

    loadSavedData();
    loadPrompts();
    initializeDriverGrid();
    loadAPISettings();

    // Add auto-save for prompts
    ['prompt-race-context', 'prompt-driver-preview', 'prompt-top5', 'prompt-underdogs'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => savePrompt(id));
    });

    // Add auto-save for API settings
    ['api-key', 'model', 'temperature'].forEach(id => {
        document.getElementById(id).addEventListener('change', saveAPISettings);
    });
}

async function loadPreviewData() {
    try {
        const response = await fetch('preview_data.json');
        if (response.ok) {
            const data = await response.json();
            generatedData = {
                ...createEmptyGeneratedData(),
                ...data,
                metadata: {
                    ...data.metadata,
                    generatedAt: new Date().toISOString()
                }
            };
            console.log('✓ Loaded pre-generated preview data');

            // Update race info display
            const raceInfo = document.getElementById('race-info');
            const raceTitle = document.getElementById('race-title');
            const raceDate = document.getElementById('race-date');

            if (data.metadata) {
                const circuitName = data.metadata.circuit || 'Unknown';
                const season = data.metadata.season || '2025';
                const date = data.metadata.date || '';

                raceTitle.textContent = `${circuitName.toUpperCase()} GP ${season}`;
                raceDate.textContent = date;
                raceInfo.style.display = 'block';

                // Fetch and display schedule
                fetchRaceSchedule(circuitName, season, date);
            }

            renderAllContent();
        }
    } catch (error) {
        console.log('No preview_data.json found, using localStorage or generate new');
    }
}

function loadSavedData() {
    const saved = localStorage.getItem('f1-preview-data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const fresh = createEmptyGeneratedData();

            generatedData = {
                ...fresh,
                ...parsed,
                metadata: {
                    ...fresh.metadata,
                    ...(parsed.metadata || {})
                }
            };
        } catch (err) {
            console.warn('Failed to parse saved preview data, starting fresh.', err);
            localStorage.removeItem('f1-preview-data');
            generatedData = createEmptyGeneratedData();
        }

        // Update UI with saved circuit/date
        if (generatedData.metadata.circuit) {
            document.getElementById('circuit').value = generatedData.metadata.circuit;
        }
        if (generatedData.metadata.date) {
            document.getElementById('race-date').value = generatedData.metadata.date;
        }
        if (generatedData.metadata.season) {
            document.getElementById('season').value = generatedData.metadata.season;
        }

        // Render saved content
        if (Object.keys(generatedData.drivers).length > 0) {
            renderAllContent();
        }
    }
}

function saveData() {
    generatedData.metadata = {
        circuit: document.getElementById('circuit').value,
        date: document.getElementById('race-date').value,
        season: document.getElementById('season').value,
        generatedAt: new Date().toISOString()
    };
    localStorage.setItem('f1-preview-data', JSON.stringify(generatedData));
}

function loadPrompts() {
    const prompts = {
        'prompt-race-context': localStorage.getItem('prompt-race-context') || defaultPrompts.raceContext,
        'prompt-driver-preview': localStorage.getItem('prompt-driver-preview') || defaultPrompts.driverPreview,
        'prompt-top5': localStorage.getItem('prompt-top5') || defaultPrompts.top5,
        'prompt-underdogs': localStorage.getItem('prompt-underdogs') || defaultPrompts.underdogs
    };

    // Auto-fix old race context prompt that doesn't contain 'json' keyword
    if (prompts['prompt-race-context'] && !prompts['prompt-race-context'].toLowerCase().includes('json')) {
        prompts['prompt-race-context'] = defaultPrompts.raceContext;
        localStorage.setItem('prompt-race-context', defaultPrompts.raceContext);
    }

    Object.keys(prompts).forEach(id => {
        document.getElementById(id).value = prompts[id];
    });
}

function savePrompt(id) {
    const value = document.getElementById(id).value;
    localStorage.setItem(id, value);

    const indicator = document.getElementById(`saved-${id.replace('prompt-', '')}`);
    indicator.style.display = 'inline-block';
    setTimeout(() => indicator.style.display = 'none', 2000);
}

function resetPromptsToDefault() {
    if (confirm('Reset all prompts to default? This cannot be undone.')) {
        Object.keys(defaultPrompts).forEach(key => {
            const id = `prompt-${key === 'driverPreview' ? 'driver-preview' : key === 'raceContext' ? 'race-context' : key}`;
            document.getElementById(id).value = defaultPrompts[key];
            localStorage.setItem(id, defaultPrompts[key]);
        });
        alert('Prompts reset to default');
    }
}

function loadAPISettings() {
    const apiKey = localStorage.getItem('api-key');
    const model = localStorage.getItem('model');
    const temperature = localStorage.getItem('temperature');

    if (apiKey) document.getElementById('api-key').value = apiKey;
    if (model) document.getElementById('model').value = model;
    if (temperature) document.getElementById('temperature').value = temperature;
}

function saveAPISettings() {
    localStorage.setItem('api-key', document.getElementById('api-key').value);
    localStorage.setItem('model', document.getElementById('model').value);
    localStorage.setItem('temperature', document.getElementById('temperature').value);
}

function clearAllData() {
    if (confirm('Clear all saved data? This will remove all generated previews and you will need to regenerate them.')) {
        localStorage.removeItem('f1-preview-data');
        generatedData = createEmptyGeneratedData();
        initializeDriverGrid();
        document.getElementById('highlights-content').innerHTML = '<div class="empty-state"><p>Generate previews to see the top 5 drivers to watch this weekend</p></div>';
        document.getElementById('underdogs-content').innerHTML = '<div class="empty-state"><p>Generate previews to discover the underdog stories</p></div>';
        alert('All data cleared');
    }
}

function togglePromptEditor() {
    const editor = document.getElementById('prompt-editor');
    editor.style.display = editor.style.display === 'none' ? 'block' : 'none';
}

async function initializeDriverGrid() {
    const grid = document.getElementById('driver-grid');

    // Team colors for 2025
    const teamColors = {
        'Red Bull': '#3671C6',
        'Ferrari': '#E8002D',
        'McLaren': '#FF8000',
        'Mercedes': '#27F4D2',
        'Aston Martin': '#229971',
        'Alpine': '#FF87BC',
        'Haas': '#B6BABD',
        'Williams': '#64C4FF',
        'Racing Bulls': '#6692FF',
        'Sauber': '#52E252'
    };

    // Change from grid to list layout
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '1rem';

    // Fetch current driver standings
    let standingsMap = {};
    try {
        const response = await fetch('https://f1api.dev/api/current/drivers-championship');
        const data = await response.json();
        if (data.drivers_championship) {
            data.drivers_championship.forEach(standing => {
                const fullName = `${standing.driver.name} ${standing.driver.surname}`;
                standingsMap[fullName] = {
                    position: standing.position,
                    points: standing.points
                };
            });
        }
    } catch (error) {
        console.error('Failed to fetch driver standings:', error);
    }

    // Sort drivers by championship position
    const sortedDrivers = [...drivers2025].sort((a, b) => {
        const posA = standingsMap[a.name]?.position || 999;
        const posB = standingsMap[b.name]?.position || 999;
        return posA - posB;
    });

    grid.innerHTML = sortedDrivers.map(driver => {
        const standing = standingsMap[driver.name];
        const hasPreview = generatedData.drivers[driver.name];
        const teamColor = teamColors[driver.team] || '#999';

        // Get stakes level and color
        const stakesLevel = hasPreview?.stakes_level || 'medium';
        const stakesColors = {
            'high': '#ff0000',
            'medium': '#ffaa00',
            'low': '#00ff88'
        };
        const stakesColor = stakesColors[stakesLevel] || stakesColors['medium'];

        return `
            <div style="display: flex; align-items: center; gap: 1rem; background: rgba(255, 255, 255, 0.03); border-left: 4px solid ${teamColor}; border: 1px solid ${teamColor}40; border-left-width: 4px; border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden;"
                 onclick="viewDriver('${driver.name}')"
                 onmouseover="this.style.background='${teamColor}20'; this.style.borderColor='${teamColor}'"
                 onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'; this.style.borderColor='${teamColor}40'; this.style.borderLeftColor='${teamColor}'; this.style.borderLeftWidth='4px'">
                <img src="${getDriverImageUrl(driver.name, 'front')}"
                     alt="${driver.name}"
                     style="width: 80px; height: 80px; min-width: 80px; border-radius: 50%; object-fit: cover; object-position: center 0%; border: 3px solid ${teamColor}; z-index: 1;"
                     onerror="this.style.display='none'">
                <div style="width: 60px; min-width: 60px; display: flex; align-items: center; justify-content: center; z-index: 1;">
                    <img src="${getDriverNumberImageUrl(driver.name)}"
                         alt="#${driver.number}"
                         style="height: 40px; width: auto; max-width: 60px; filter: drop-shadow(0 2px 6px ${teamColor}80);"
                         onerror="this.outerHTML='<span style=\\'font-size: 1.2rem; font-weight: bold; color: ${teamColor};\\'>##${driver.number}</span>'">
                </div>
                <div style="flex: 1; cursor: pointer; z-index: 1;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem;">
                        <span style="font-size: 1.1rem; font-weight: 600; cursor: pointer;">${driver.name}</span>
                        ${standing ? `<span style="color: #888; font-size: 0.9rem; font-family: 'Formula1', sans-serif; font-weight: bold;">P${standing.position} • ${standing.points} pts</span>` : ''}
                    </div>
                    <div style="color: #999; font-size: 0.95rem;">${driver.team}</div>
                    ${hasPreview ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: ${stakesColor}; text-transform: uppercase; font-weight: bold;">${stakesLevel} stakes</div>` : ''}
                </div>
                <img src="${getCarImageUrl(driver.name)}"
                     alt="${driver.team} car"
                     style="position: absolute; right: -20px; top: 50%; transform: translateY(-50%); height: 100px; width: auto; opacity: 0.15; z-index: 0; pointer-events: none;"
                     onerror="this.style.display='none'">
            </div>
        `;
    }).join('');
}

function switchTab(evt, tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add('active');
    }

    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

    const target = document.getElementById(`${tab}-content`);
    if (target) {
        target.style.display = 'block';
    }
}

async function generateAllPreviews() {
    const apiKey = document.getElementById('api-key').value;
    const model = document.getElementById('model').value;
    const circuit = document.getElementById('circuit').value;
    const raceDate = document.getElementById('race-date').value;
    const season = document.getElementById('season').value;
    const temperature = parseFloat(document.getElementById('temperature').value);

    if (!apiKey) {
        alert('Please enter your OpenAI API key');
        return;
    }

    const btn = document.querySelector('.generate-btn');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    btn.disabled = true;
    progressContainer.style.display = 'block';

    const total = drivers2025.length + 2; // drivers + top5 + underdogs
    let completed = 0;

    try {
        // Generate weather/circuit context first
        progressText.textContent = 'Fetching race weekend context...';
        generatedData.raceContext = await generateRaceContext(apiKey, model, circuit, raceDate, season, temperature);

        // Generate all driver previews in parallel (async)
        progressText.textContent = 'Generating all driver previews in parallel...';

        const driverPromises = drivers2025.map(async (driver) => {
            const card = document.getElementById(`card-${driver.number}`);
            card.classList.add('loading');
            card.querySelector('.status-badge').textContent = '⏳';

            try {
                const preview = await generateDriverPreview(apiKey, model, driver, circuit, generatedData.raceContext, temperature);
                generatedData.drivers[driver.name] = preview;

                card.classList.remove('loading');
                card.classList.add('generated');
                card.querySelector('.status-badge').textContent = '✓';

                completed++;
                const percent = Math.round((completed / total) * 100);
                progressFill.style.width = `${percent}%`;
                progressFill.textContent = `${percent}%`;
                progressText.textContent = `Generated ${completed} of ${drivers2025.length} drivers...`;

                return preview;
            } catch (error) {
                card.classList.remove('loading');
                card.querySelector('.status-badge').textContent = '❌';
                console.error(`Error generating preview for ${driver.name}:`, error);
                return null;
            }
        });

        await Promise.all(driverPromises);

        // Generate top 5 to watch
        progressText.textContent = 'Analyzing top 5 drivers to watch...';
        generatedData.top5 = await generateTop5(apiKey, model, generatedData.drivers, generatedData.raceContext, temperature);
        completed++;
        progressFill.style.width = `${Math.round((completed / total) * 100)}%`;

        // Generate underdog stories
        progressText.textContent = 'Identifying underdog stories...';
        generatedData.underdogs = await generateUnderdogs(apiKey, model, generatedData.drivers, generatedData.raceContext, temperature);
        completed++;
        progressFill.style.width = '100%';
        progressFill.textContent = '100%';

        progressText.textContent = 'Complete! Saving and rendering...';

        // Save to localStorage
        saveData();

        // Render all content
        renderAllContent();

        setTimeout(() => {
            btn.disabled = false;
            progressContainer.style.display = 'none';
            alert('All previews generated and saved successfully!');
        }, 1000);

    } catch (error) {
        console.error('Generation error:', error);
        btn.disabled = false;
        progressContainer.style.display = 'none';
        alert('Error generating previews: ' + error.message);
    }
}

function renderAllContent() {
    renderHighlights();
    renderUnderdogs();
    initializeDriverGrid();
}

async function generateRaceContext(apiKey, model, circuit, raceDate, season, temperature) {
    const promptTemplate = document.getElementById('prompt-race-context').value;
    const prompt = promptTemplate
        .replace('{circuit}', circuit)
        .replace('{raceDate}', raceDate)
        .replace('{season}', season);

    return await callOpenAI(apiKey, model, prompt, temperature, { responseFormat: { type: 'json_object' } });
}

async function generateDriverPreview(apiKey, model, driver, circuit, raceContext, temperature) {
    const promptTemplate = document.getElementById('prompt-driver-preview').value;
    const prompt = promptTemplate
        .replace('{driverName}', driver.name)
        .replace('{driverNumber}', driver.number)
        .replace('{team}', driver.team)
        .replace('{circuit}', circuit)
        .replace('{raceContext}', raceContext);

    const response = await callOpenAI(apiKey, model, prompt, temperature, { responseFormat: { type: 'json_object' } });

    // Try to parse as JSON, fallback to text
    try {
        return typeof response === 'string' ? JSON.parse(response) : response;
    } catch {
        return {
            tldr: response.substring(0, 200),
            full: response,
            perfect_quali: 'TBD',
            perfect_race: 'TBD',
            stakes_level: 'medium'
        };
    }
}

async function generateTop5(apiKey, model, driverPreviews, raceContext, temperature) {
    const promptTemplate = document.getElementById('prompt-top5').value;
    const driversData = JSON.stringify(driverPreviews, null, 2);
    const prompt = promptTemplate + '\n\nDriver Previews:\n' + driversData + '\n\nRace Context:\n' + raceContext;

    const response = await callOpenAI(apiKey, model, prompt, temperature, { responseFormat: { type: 'json_object' } });

    try {
        return typeof response === 'string' ? JSON.parse(response) : response;
    } catch {
        return [];
    }
}

async function generateUnderdogs(apiKey, model, driverPreviews, raceContext, temperature) {
    const promptTemplate = document.getElementById('prompt-underdogs').value;
    const driversData = JSON.stringify(driverPreviews, null, 2);
    const prompt = promptTemplate + '\n\nDriver Previews:\n' + driversData + '\n\nRace Context:\n' + raceContext;

    const response = await callOpenAI(apiKey, model, prompt, temperature, { responseFormat: { type: 'json_object' } });

    try {
        return typeof response === 'string' ? JSON.parse(response) : response;
    } catch {
        return [];
    }
}

async function callOpenAI(apiKey, model, prompt, temperature, options = {}) {
    const requestBody = {
        model: model,
        input: prompt,
        max_output_tokens: 30000
    };

    const isGPT5Family = /^gpt-5/i.test(model);

    // Add temperature for non-GPT-5 models
    if (!isGPT5Family) {
        requestBody.temperature = temperature;
    }

    // Handle text.format for structured outputs
    if (options.responseFormat) {
        const { type, json_schema } = options.responseFormat;

        if (type === 'json_object') {
            // Simple JSON object mode
            requestBody.text = {
                format: {
                    type: 'json_object'
                }
            };
        } else if (type === 'json_schema' && json_schema) {
            // Structured outputs with schema validation
            requestBody.text = {
                format: {
                    type: 'json_schema',
                    json_schema: json_schema
                }
            };
        }
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data?.error?.message || response.statusText || 'Unknown error';
        throw new Error(`API Error: ${response.status} ${message}`);
    }

    // Debug: log response structure
    console.log('API Response:', JSON.stringify(data, null, 2));

    // Check for incomplete response
    if (data.status === 'incomplete') {
        const reason = data.incomplete_details?.reason || 'unknown';
        throw new Error(`Response incomplete: ${reason}. Try increasing max_output_tokens.`);
    }

    // Parse response: look for message with content in output array
    if (Array.isArray(data.output)) {
        for (const item of data.output) {
            if (item.type === 'message' && Array.isArray(item.content)) {
                for (const part of item.content) {
                    // Handle both 'text' and 'output_text' types
                    if ((part.type === 'text' || part.type === 'output_text') && typeof part.text === 'string') {
                        return part.text.trim();
                    }
                }
            }
        }
    }

    throw new Error('No text content found in response. Check console for details.');
}

function getDriverImageUrl(driverName, angle = 'right') {
    // Map of driver names to their team and code for 2025
    const driverInfo = {
        'Max Verstappen': { team: 'redbullracing', code: 'maxver01' },
        'Yuki Tsunoda': { team: 'redbullracing', code: 'yuktsu01' },
        'Lewis Hamilton': { team: 'ferrari', code: 'lewham01' },
        'Charles Leclerc': { team: 'ferrari', code: 'chalec01' },
        'Lando Norris': { team: 'mclaren', code: 'lannor01' },
        'Oscar Piastri': { team: 'mclaren', code: 'oscpia01' },
        'George Russell': { team: 'mercedes', code: 'georus01' },
        'Kimi Antonelli': { team: 'mercedes', code: 'andant01' },
        'Fernando Alonso': { team: 'astonmartin', code: 'feralo01' },
        'Lance Stroll': { team: 'astonmartin', code: 'lanstr01' },
        'Pierre Gasly': { team: 'alpine', code: 'piegas01' },
        'Franco Colapinto': { team: 'alpine', code: 'fracol01' },
        'Esteban Ocon': { team: 'haas', code: 'estoco01' },
        'Oliver Bearman': { team: 'haas', code: 'olibea01' },
        'Alex Albon': { team: 'williams', code: 'alealb01' },
        'Carlos Sainz': { team: 'williams', code: 'carsai01' },
        'Liam Lawson': { team: 'racingbulls', code: 'lialaw01' },
        'Isack Hadjar': { team: 'racingbulls', code: 'isahad01' },
        'Nico Hulkenberg': { team: 'kicksauber', code: 'nichul01' },
        'Gabriel Bortoleto': { team: 'kicksauber', code: 'gabbor01' }
    };

    const info = driverInfo[driverName];
    if (!info) return 'https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/drivers/number-logo/GENERIC.png';

    return `https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2025:fallback:driver:2025fallbackdriver${angle}.webp/v1740000000/common/f1/2025/${info.team}/${info.code}/2025${info.team}${info.code}${angle}.webp`;
}

function getDriverNumberImageUrl(driverName) {
    const driverInfo = {
        'Max Verstappen': { team: 'redbullracing', code: 'maxver01' },
        'Yuki Tsunoda': { team: 'redbullracing', code: 'yuktsu01' },
        'Lewis Hamilton': { team: 'ferrari', code: 'lewham01' },
        'Charles Leclerc': { team: 'ferrari', code: 'chalec01' },
        'Lando Norris': { team: 'mclaren', code: 'lannor01' },
        'Oscar Piastri': { team: 'mclaren', code: 'oscpia01' },
        'George Russell': { team: 'mercedes', code: 'georus01' },
        'Kimi Antonelli': { team: 'mercedes', code: 'andant01' },
        'Fernando Alonso': { team: 'astonmartin', code: 'feralo01' },
        'Lance Stroll': { team: 'astonmartin', code: 'lanstr01' },
        'Pierre Gasly': { team: 'alpine', code: 'piegas01' },
        'Franco Colapinto': { team: 'alpine', code: 'fracol01' },
        'Esteban Ocon': { team: 'haas', code: 'estoco01' },
        'Oliver Bearman': { team: 'haas', code: 'olibea01' },
        'Alex Albon': { team: 'williams', code: 'alealb01' },
        'Carlos Sainz': { team: 'williams', code: 'carsai01' },
        'Liam Lawson': { team: 'racingbulls', code: 'lialaw01' },
        'Isack Hadjar': { team: 'racingbulls', code: 'isahad01' },
        'Nico Hulkenberg': { team: 'kicksauber', code: 'nichul01' },
        'Gabriel Bortoleto': { team: 'kicksauber', code: 'gabbor01' }
    };

    const info = driverInfo[driverName];
    if (!info) return null;

    return `https://media.formula1.com/image/upload/c_fit,w_876,h_742/q_auto/v1740000000/common/f1/2025/${info.team}/${info.code}/2025${info.team}${info.code}numberwhitefrless.webp`;
}

function getTeamLogoUrl(driverName) {
    const driverInfo = {
        'Max Verstappen': { team: 'redbullracing' },
        'Yuki Tsunoda': { team: 'redbullracing' },
        'Lewis Hamilton': { team: 'ferrari' },
        'Charles Leclerc': { team: 'ferrari' },
        'Lando Norris': { team: 'mclaren' },
        'Oscar Piastri': { team: 'mclaren' },
        'George Russell': { team: 'mercedes' },
        'Kimi Antonelli': { team: 'mercedes' },
        'Fernando Alonso': { team: 'astonmartin' },
        'Lance Stroll': { team: 'astonmartin' },
        'Pierre Gasly': { team: 'alpine' },
        'Franco Colapinto': { team: 'alpine' },
        'Esteban Ocon': { team: 'haas' },
        'Oliver Bearman': { team: 'haas' },
        'Alex Albon': { team: 'williams' },
        'Carlos Sainz': { team: 'williams' },
        'Liam Lawson': { team: 'racingbulls' },
        'Isack Hadjar': { team: 'racingbulls' },
        'Nico Hulkenberg': { team: 'kicksauber' },
        'Gabriel Bortoleto': { team: 'kicksauber' }
    };

    const info = driverInfo[driverName];
    if (!info) return null;

    return `https://media.formula1.com/image/upload/c_lfill,w_48/q_auto/v1740000000/common/f1/2025/${info.team}/2025${info.team}logo.webp`;
}

function getCarImageUrl(driverName) {
    const driverInfo = {
        'Max Verstappen': { team: 'redbullracing' },
        'Yuki Tsunoda': { team: 'redbullracing' },
        'Lewis Hamilton': { team: 'ferrari' },
        'Charles Leclerc': { team: 'ferrari' },
        'Lando Norris': { team: 'mclaren' },
        'Oscar Piastri': { team: 'mclaren' },
        'George Russell': { team: 'mercedes' },
        'Kimi Antonelli': { team: 'mercedes' },
        'Fernando Alonso': { team: 'astonmartin' },
        'Lance Stroll': { team: 'astonmartin' },
        'Pierre Gasly': { team: 'alpine' },
        'Franco Colapinto': { team: 'alpine' },
        'Esteban Ocon': { team: 'haas' },
        'Oliver Bearman': { team: 'haas' },
        'Alex Albon': { team: 'williams' },
        'Carlos Sainz': { team: 'williams' },
        'Liam Lawson': { team: 'racingbulls' },
        'Isack Hadjar': { team: 'racingbulls' },
        'Nico Hulkenberg': { team: 'kicksauber' },
        'Gabriel Bortoleto': { team: 'kicksauber' }
    };

    const info = driverInfo[driverName];
    if (!info) return null;

    return `https://media.formula1.com/image/upload/c_lfill,w_512/q_auto/d_common:f1:2025:fallback:car:2025fallbackcarright.webp/v1740000000/common/f1/2025/${info.team}/2025${info.team}carright.webp`;
}

function renderHighlights() {
    const content = document.getElementById('highlights-content');

    // Handle nested structure from Python generation
    const top5Data = generatedData.top5?.drivers || generatedData.top5 || [];

    if (!top5Data || top5Data.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>Generate previews to see the top 5 drivers to watch this weekend</p></div>';
        return;
    }

    const circuitName = generatedData.metadata?.circuit || 'Unknown';
    const season = generatedData.metadata?.season || '2025';

    const teamColors = {
        'Red Bull': '#3671C6',
        'Ferrari': '#E8002D',
        'McLaren': '#FF8000',
        'Mercedes': '#27F4D2',
        'Aston Martin': '#229971',
        'Alpine': '#FF87BC',
        'Haas': '#B6BABD',
        'Williams': '#64C4FF',
        'Racing Bulls': '#6692FF',
        'Sauber': '#52E252'
    };

    content.innerHTML = `
        <div style="background: transparent; padding: 0;">
            <h3 style="color: #4db8ff; margin-bottom: 1.5rem;">Top 5 Drivers to Watch - ${circuitName.toUpperCase()} GP ${season}</h3>
            ${top5Data.map((item, i) => {
                const driver = drivers2025.find(d => d.name === item.driver);
                const teamColor = driver ? teamColors[driver.team] || '#999' : '#999';
                return `
                    <div style="background: #1a1a1a; border-top: 3px solid ${teamColor}; padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 16px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1);">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <img src="${getDriverImageUrl(item.driver)}"
                                 alt="${item.driver}"
                                 style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; object-position: center 0%; border: 3px solid ${teamColor}; box-shadow: 0 4px 12px ${teamColor}60; cursor: pointer;"
                                 onclick="viewDriver('${item.driver}')"
                                 onerror="this.style.display='none'">
                            <h4 style="margin: 0; color: ${teamColor}; font-size: 1.2rem; cursor: pointer;" onclick="viewDriver('${item.driver}')">#${item.rank || i + 1} ${item.driver}</h4>
                        </div>
                        <p style="color: #ddd; line-height: 1.6;"><strong style="color: #fff;">Why watch:</strong> ${item.reason}</p>
                        ${item.stakes ? `<p style="color: ${teamColor}; margin-top: 0.75rem; line-height: 1.6;"><strong style="color: #fff;">Stakes:</strong> ${item.stakes}</p>` : ''}
                        <a href="#" onclick="viewDriver('${item.driver}'); return false;" style="color: ${teamColor}; margin-top: 0.75rem; display: inline-block; font-weight: 500;">View full preview →</a>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderUnderdogs() {
    const content = document.getElementById('underdogs-content');

    // Handle nested structure from Python generation
    const underdogsData = generatedData.underdogs?.underdogs || generatedData.underdogs || [];

    if (!underdogsData || underdogsData.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>Generate previews to discover the underdog stories</p></div>';
        return;
    }

    const circuitName = generatedData.metadata?.circuit || 'Unknown';
    const season = generatedData.metadata?.season || '2025';

    const teamColors = {
        'Red Bull': '#3671C6',
        'Ferrari': '#E8002D',
        'McLaren': '#FF8000',
        'Mercedes': '#27F4D2',
        'Aston Martin': '#229971',
        'Alpine': '#FF87BC',
        'Haas': '#B6BABD',
        'Williams': '#64C4FF',
        'Racing Bulls': '#6692FF',
        'Sauber': '#52E252'
    };

    content.innerHTML = `
        <div style="background: transparent; padding: 0;">
            <h3 style="color: #ff8800; margin-bottom: 1.5rem;">Underdog Stories - ${circuitName.toUpperCase()} GP ${season}</h3>
            ${underdogsData.map((item, i) => {
                const driver = drivers2025.find(d => d.name === item.driver);
                const teamColor = driver ? teamColors[driver.team] || '#999' : '#999';
                return `
                    <div style="background: #1a1a1a; border-top: 3px solid ${teamColor}; padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 16px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1);">
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <img src="${getDriverImageUrl(item.driver)}"
                                 alt="${item.driver}"
                                 style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; object-position: center 0%; border: 3px solid ${teamColor}; box-shadow: 0 4px 12px ${teamColor}60; cursor: pointer;"
                                 onclick="viewDriver('${item.driver}')"
                                 onerror="this.style.display='none'">
                            <div style="flex: 1;">
                                <h4 style="margin: 0 0 0.25rem 0; color: ${teamColor}; font-size: 1.2rem; cursor: pointer;" onclick="viewDriver('${item.driver}')">${item.driver}</h4>
                                <p style="margin: 0; color: ${teamColor}; font-size: 0.95rem; font-style: italic; opacity: 0.9;">${item.title}</p>
                            </div>
                        </div>
                        <p style="color: #ddd; line-height: 1.6;">${item.story}</p>
                        ${item.surprise_factor ? `<p style="color: #00ff88; margin-top: 0.75rem; line-height: 1.6;"><strong style="color: #fff;">Surprise Factor:</strong> ${item.surprise_factor}</p>` : ''}
                        <a href="#" onclick="viewDriver('${item.driver}'); return false;" style="color: ${teamColor}; margin-top: 0.75rem; display: inline-block; font-weight: 500;">View full preview →</a>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function viewDriver(driverName) {
    const preview = generatedData.drivers[driverName];
    if (!preview) {
        alert('Preview not yet generated for ' + driverName);
        return;
    }

    const driver = drivers2025.find(d => d.name === driverName);
    const modal = document.getElementById('driver-modal');
    const modalName = document.getElementById('modal-driver-name');
    const modalContent = document.getElementById('modal-driver-content');

    modalName.textContent = `${driverName} - #${driver.number} ${driver.team}`;

    const teamColors = {
        'Red Bull': '#3671C6',
        'Ferrari': '#E8002D',
        'McLaren': '#FF8000',
        'Mercedes': '#27F4D2',
        'Aston Martin': '#229971',
        'Alpine': '#FF87BC',
        'Haas': '#B6BABD',
        'Williams': '#64C4FF',
        'Racing Bulls': '#6692FF',
        'Sauber': '#52E252'
    };
    const teamColor = teamColors[driver.team] || '#e10600';

    // Show loading state for OpenF1 data
    modalContent.innerHTML = `
        <div style="display: grid; grid-template-columns: 250px 1fr; gap: 2rem; margin-bottom: 2rem;">
                <!-- Driver Image -->
                <div style="position: sticky; top: 0; align-self: start;">
                    <img src="${getDriverImageUrl(driverName, 'left')}"
                         alt="${driverName}"
                         style="width: 100%; height: auto; border-radius: 12px; border: 3px solid ${teamColor}; box-shadow: 0 8px 24px ${teamColor}40;"
                         onerror="this.style.display='none'">
                    <div style="text-align: center; margin-top: 1rem; padding: 0.75rem; background: #1a1a1a; border-radius: 12px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1);">
                        <img src="${getDriverNumberImageUrl(driverName)}"
                             alt="#${driver.number}"
                             style="width: 40%; height: auto; filter: drop-shadow(0 4px 8px ${teamColor}80);"
                             onerror="this.innerHTML='<div style=\\'font-size: 2rem; font-weight: bold; color: ${teamColor};\\'>##${driver.number}</div>'">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.75rem;">
                            <img src="${getTeamLogoUrl(driverName)}"
                                 alt="${driver.team}"
                                 style="width: 32px; height: auto;"
                                 onerror="this.style.display='none'">
                            <div style="color: #ccc; font-size: 0.9rem;">${driver.team}</div>
                        </div>
                    </div>

                    <!-- Fetch OpenF1 data for pearl display -->
                    <div id="openf1-pearls-sidebar" style="margin-top: 1.5rem;"></div>
                </div>

                <!-- Content -->
                <div>
                    <!-- Recent Form Pearls at top -->
                    <div id="openf1-pearls-top" style="margin-bottom: 2rem;">
                        <div style="text-align: center; color: #666; padding: 1rem;">Loading recent form...</div>
                    </div>
                    <div style="background: #1a1a1a; padding: 1.5rem; border-radius: 16px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1); margin-bottom: 1.5rem; border-top: 3px solid ${teamColor};">
                        <h3 style="font-family: 'Formula1', sans-serif; font-weight: normal; color: ${teamColor}; margin-bottom: 1rem;">TL;DR</h3>
                        <div class="tldr" style="font-size: 1.05rem; line-height: 1.6; color: #ddd;">${preview.tldr}</div>
                    </div>

                    <h3 style="font-family: 'Formula1', sans-serif; font-weight: normal; color: #fff; margin-bottom: 1rem;">Full Analysis</h3>
                    <div class="full-text" style="color: #ddd; line-height: 1.8;">
                        ${simpleMarkdownToHtml(preview.full)}
                    </div>
                </div>
            </div>

            <div style="margin-top: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div style="background: #1a1a1a; padding: 1.5rem; border-radius: 16px; box-shadow: inset 4px 4px 8px rgba(0, 0, 0, 0.5), inset -4px -4px 8px rgba(40, 40, 40, 0.1); border-top: 2px solid #00ff88;">
                    <strong style="color: #00ff88; font-size: 1.1rem;">Perfect Weekend</strong><br>
                    <div style="margin-top: 0.75rem; color: #ccc;">
                        <div style="margin-bottom: 0.5rem;">🏁 Quali: ${preview.perfect_quali || 'N/A'}</div>
                        <div>🏆 Race: ${preview.perfect_race || 'N/A'}</div>
                    </div>
                </div>
                <div style="background: #1a1a1a; padding: 1.5rem; border-radius: 16px; box-shadow: inset 4px 4px 8px rgba(0, 0, 0, 0.5), inset -4px -4px 8px rgba(40, 40, 40, 0.1); border-top: 2px solid #ffaa00;">
                    <strong style="color: #ffaa00; font-size: 1.1rem;">Good Weekend</strong><br>
                    <div style="margin-top: 0.75rem; color: #ccc;">
                        <div style="margin-bottom: 0.5rem;">🏁 Quali: ${preview.good_quali || 'N/A'}</div>
                        <div>🏆 Race: ${preview.good_race || 'N/A'}</div>
                    </div>
                </div>
            </div>

            ${preview.key_strengths ? `
                <div style="margin-top: 1.5rem; background: #1a1a1a; padding: 1.5rem; border-radius: 16px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1); border-top: 2px solid ${teamColor};">
                    <strong style="color: ${teamColor};">Key Strengths:</strong>
                    <div style="margin-top: 0.5rem; color: #ddd;">${preview.key_strengths.join(' • ')}</div>
                </div>
            ` : ''}

            ${preview.watch_for ? `
                <div style="margin-top: 1.5rem; background: #1a1a1a; padding: 1.5rem; border-radius: 16px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1); border-top: 3px solid ${teamColor};">
                    <strong style="color: ${teamColor}; font-size: 1.1rem;">Watch For:</strong>
                    <div style="margin-top: 0.5rem; color: #ddd;">${preview.watch_for}</div>
                </div>
            ` : ''}

            <div style="margin-top: 1.5rem; text-align: center; padding: 1rem; background: #1a1a1a; border-radius: 16px; box-shadow: inset 4px 4px 8px rgba(0, 0, 0, 0.5), inset -4px -4px 8px rgba(40, 40, 40, 0.1);">
                Stakes Level: <span style="color: ${preview.stakes_level === 'high' ? '#ff0000' : preview.stakes_level === 'medium' ? '#ffaa00' : '#00ff88'}; text-transform: uppercase; font-weight: bold; font-size: 1.2rem;">${preview.stakes_level || 'Medium'}</span>
            </div>
    `;

    modal.style.display = 'block';

    // Fetch race and qualifying results from f1api.dev
    try {
        // Max Verstappen uses #1 as champion but API tracks him as #33
        const apiNumber = driver.number === 1 ? 33 : driver.number;
        const results = await f1API.getDriverResults(apiNumber);

        const pearlsTopContainer = document.getElementById('openf1-pearls-top');
        if (pearlsTopContainer) {
            pearlsTopContainer.innerHTML = renderCompactPearls({
                qualifying: results.qualifying,
                race: results.race
            }, driver);
        }
    } catch (error) {
        console.error('Error loading race data:', error);
        const pearlsTopContainer = document.getElementById('openf1-pearls-top');
        if (pearlsTopContainer) {
            pearlsTopContainer.innerHTML = '';
        }
    }
}

function renderCompactPearls(results, driver) {
    const teamColors = {
        'Red Bull': '#3671C6',
        'Ferrari': '#E8002D',
        'McLaren': '#FF8000',
        'Mercedes': '#27F4D2',
        'Aston Martin': '#229971',
        'Alpine': '#FF87BC',
        'Haas': '#B6BABD',
        'Williams': '#64C4FF',
        'Racing Bulls': '#6692FF',
        'Sauber': '#52E252'
    };
    const teamColor = teamColors[driver.team] || '#999';

    const { qualifying, race } = results;

    const renderPearlString = (results, label) => {
        if (!results || results.length === 0) return '';

        return `
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                <div style="
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                    transform: rotate(180deg);
                    color: #888;
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    min-width: 20px;
                ">${label}</div>
                <div style="display: flex; align-items: center; position: relative; flex: 1; padding: 0.5rem 0;">
                    <!-- Connection line -->
                    <div style="position: absolute; top: 50%; left: 5%; right: 5%; height: 1px; background: linear-gradient(90deg, ${teamColor}30 0%, ${teamColor}15 50%, ${teamColor}30 100%); z-index: 0;"></div>

                    ${results.map(result => {
                        const isDNF = result.dnf || result.dns;
                        const isP1 = result.position === 1;
                        // Smaller pearls: P1 = 38px, P2-3 = 32px, P4-10 = 28px, P11+ = 24px, DNF = 24px
                        const size = isDNF ? 24 : isP1 ? 38 : result.position <= 3 ? 32 : result.position <= 10 ? 28 : 24;
                        const color = result.dnf ? '#ff0000' : result.dns ? '#666' : isP1 ? '#FFD700' : result.position <= 3 ? '#00ff88' : result.position <= 10 ? teamColor : '#666';
                        const label = result.dnf ? 'DNF' : result.dns ? 'DNS' : `P${result.position}`;
                        // Fixed font sizes: P1 larger, others proportional
                        const fontSize = isDNF ? '0.6rem' : isP1 ? '0.95rem' : result.position <= 3 ? '0.8rem' : result.position <= 9 ? '0.75rem' : '0.7rem';
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; z-index: 1; margin: 0 0.4rem;">
                                <div style="
                                    width: ${size}px;
                                    height: ${size}px;
                                    border-radius: 50%;
                                    background: ${color};
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-weight: bold;
                                    font-size: ${fontSize};
                                    color: ${isP1 ? '#000' : '#000'};
                                    box-shadow: ${isP1 ? `0 0 20px ${color}, 0 4px 12px ${color}80` : `0 4px 12px ${color}80`}, inset 0 2px 4px rgba(255,255,255,0.3);
                                    border: ${isP1 ? '3px' : '2px'} solid ${color};
                                    position: relative;
                                    ${isDNF ? 'opacity: 0.7;' : ''}
                                    ${isP1 ? 'animation: pulse-gold 2s infinite;' : ''}
                                ">
                                    ${label}
                                </div>
                                <div style="font-size: 0.75rem; margin-top: 0.2rem;">${getCircuitFlag(result.circuit)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    return `
        <style>
            @keyframes pulse-gold {
                0%, 100% { box-shadow: 0 0 20px #FFD700, 0 4px 12px #FFD70080, inset 0 2px 4px rgba(255,255,255,0.3); }
                50% { box-shadow: 0 0 30px #FFD700, 0 4px 16px #FFD700CC, inset 0 2px 4px rgba(255,255,255,0.5); }
            }
        </style>
        <div style="background: #1a1a1a; padding: 0.75rem 1rem; border-radius: 16px; box-shadow: 6px 6px 12px rgba(0, 0, 0, 0.5), -6px -6px 12px rgba(40, 40, 40, 0.1);">
            <h3 style="font-family: 'Formula1', sans-serif; font-weight: normal; color: ${teamColor}; margin-bottom: 0.75rem; text-align: center; font-size: 1rem;">Recent Form</h3>
            ${renderPearlString(qualifying, 'Qualifying')}
            ${renderPearlString(race, 'Race')}
        </div>
    `;
}

function simpleMarkdownToHtml(markdown) {
    if (!markdown) return '';

    // Split into lines for processing
    const lines = markdown.split('\n');
    let html = '';
    let inList = false;
    let inOrderedList = false;
    let currentParagraph = '';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Check if it's a header
        if (trimmed.startsWith('### ')) {
            if (currentParagraph) {
                html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            html += `<h4 style="font-family: 'Formula1', sans-serif; font-weight: normal; color: #ccc; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1rem;">${trimmed.substring(4)}</h4>`;
        } else if (trimmed.startsWith('## ')) {
            if (currentParagraph) {
                html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            html += `<h3 style="font-family: 'Formula1', sans-serif; font-weight: normal; color: #e10600; margin-top: 1.5rem; margin-bottom: 0.75rem; font-size: 1.2rem;">${trimmed.substring(3)}</h3>`;
        } else if (trimmed.startsWith('# ')) {
            if (currentParagraph) {
                html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            html += `<h2 style="font-family: 'Formula1', sans-serif; font-weight: bold; color: #fff; margin-top: 1.5rem; margin-bottom: 1rem; font-size: 1.4rem;">${trimmed.substring(2)}</h2>`;
        }
        // Check if it's a bullet point
        else if (trimmed.match(/^[-*]\s+(.+)$/)) {
            if (currentParagraph) {
                html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            if (!inList) {
                html += '<ul style="margin: 1rem 0; padding-left: 1.5rem; line-height: 1.8;">';
                inList = true;
            }
            const content = trimmed.substring(2).trim();
            html += `<li style="margin-bottom: 0.5rem; color: #ddd;">${processInlineMarkdown(content)}</li>`;
        }
        // Check if it's a numbered list
        else if (trimmed.match(/^\d+\.\s+(.+)$/)) {
            if (currentParagraph) {
                html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (!inOrderedList) {
                html += '<ol style="margin: 1rem 0; padding-left: 1.5rem; line-height: 1.8;">';
                inOrderedList = true;
            }
            const content = trimmed.replace(/^\d+\.\s+/, '');
            html += `<li style="margin-bottom: 0.5rem; color: #ddd;">${processInlineMarkdown(content)}</li>`;
        }
        // Empty line - paragraph break
        else if (trimmed === '') {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            if (currentParagraph) {
                html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
                currentParagraph = '';
            }
        }
        // Regular text
        else {
            if (inList) {
                html += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                html += '</ol>';
                inOrderedList = false;
            }
            if (currentParagraph) {
                currentParagraph += ' ';
            }
            currentParagraph += processInlineMarkdown(trimmed);
        }
    }

    // Close any remaining open tags
    if (inList) {
        html += '</ul>';
    }
    if (inOrderedList) {
        html += '</ol>';
    }
    if (currentParagraph) {
        html += `<p style="margin-bottom: 1rem; line-height: 1.6;">${currentParagraph}</p>`;
    }

    return html;
}

function processInlineMarkdown(text) {
    return text
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color: #fff;">$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.+?)`/g, '<code style="background: rgba(255,255,255,0.1); padding: 0.2rem 0.4rem; border-radius: 3px; font-family: monospace;">$1</code>');
}

function getCircuitFlag(circuitName) {
    const circuitToCountry = {
        'Bahrain International Circuit': 'BH',
        'Bahrain': 'BH',
        'Jeddah Corniche Circuit': 'SA',
        'Jeddah': 'SA',
        'Albert Park Circuit': 'AU',
        'Albert Park': 'AU',
        'Melbourne': 'AU',
        'Suzuka International Circuit': 'JP',
        'Suzuka': 'JP',
        'Shanghai International Circuit': 'CN',
        'Shanghai': 'CN',
        'Miami International Autodrome': 'US',
        'Miami': 'US',
        'Imola Autodromo Internazionale Enzo e Dino Ferrari': 'IT',
        'Imola': 'IT',
        'Circuit de Monaco': 'MC',
        'Monaco': 'MC',
        'Circuit Gilles Villeneuve': 'CA',
        'Montreal': 'CA',
        'Circuit de Barcelona-Catalunya': 'ES',
        'Barcelona': 'ES',
        'Catalunya': 'ES',
        'Red Bull Ring': 'AT',
        'Spielberg': 'AT',
        'Silverstone Circuit': 'GB',
        'Silverstone': 'GB',
        'Hungaroring': 'HU',
        'Circuit de Spa-Francorchamps': 'BE',
        'Spa-Francorchamps': 'BE',
        'Circuit Zandvoort': 'NL',
        'Zandvoort': 'NL',
        'Autodromo Nazionale Monza': 'IT',
        'Monza': 'IT',
        'Baku City Circuit': 'AZ',
        'Baku': 'AZ',
        'Marina Bay Street Circuit': 'SG',
        'Marina Bay': 'SG',
        'Singapore': 'SG',
        'Circuit of The Americas': 'US',
        'Austin': 'US',
        'Autódromo Hermanos Rodríguez': 'MX',
        'Mexico City': 'MX',
        'Autodromo José Carlos Pace | Interlagos': 'BR',
        'Interlagos': 'BR',
        'São Paulo': 'BR',
        'Las Vegas Strip Circuit': 'US',
        'Las Vegas': 'US',
        'Lusail International Circuit': 'QA',
        'Lusail': 'QA',
        'Qatar': 'QA',
        'Yas Marina Circuit': 'AE',
        'Yas Marina': 'AE',
        'Abu Dhabi': 'AE'
    };

    const countryCode = circuitToCountry[circuitName];
    if (countryCode) {
        return `<img src="https://flagsapi.com/${countryCode}/flat/32.png" alt="${circuitName}" style="width: 20px; height: 15px; object-fit: cover; border-radius: 2px; display: inline-block; vertical-align: middle;">`;
    }
    return '🏁';
}

function renderOpenF1Graphics(qualiResults, raceResults, driver) {
    const teamColors = {
        'Red Bull': '#3671C6',
        'Ferrari': '#E8002D',
        'McLaren': '#FF8000',
        'Mercedes': '#27F4D2',
        'Aston Martin': '#229971',
        'Alpine': '#FF87BC',
        'Haas': '#B6BABD',
        'Williams': '#64C4FF',
        'Racing Bulls': '#6692FF',
        'Sauber': '#52E252'
    };
    const teamColor = teamColors[driver.team] || '#999';

    return `
        <h3 style="color: ${teamColor}; margin-bottom: 2rem;">Recent Form</h3>

        ${qualiResults.length > 0 ? `
            <div style="margin-bottom: 3rem;">
                <h4 style="color: #ccc; margin-bottom: 1.5rem;">Qualifying Results</h4>
                <div style="display: flex; align-items: center; justify-content: space-around; position: relative; padding: 2rem 0;">
                    <!-- Connection line -->
                    <div style="position: absolute; top: 50%; left: 5%; right: 5%; height: 2px; background: linear-gradient(90deg, ${teamColor}40 0%, ${teamColor}20 50%, ${teamColor}40 100%); z-index: 0;"></div>

                    ${qualiResults.slice(-8).map(result => {
                        // Size based on position: P1 = 70px, P20 = 30px
                        const size = Math.max(30, 70 - (result.position * 2));
                        const color = result.position <= 3 ? '#00ff88' : result.position <= 10 ? teamColor : '#666';
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; z-index: 1;">
                                <div style="
                                    width: ${size}px;
                                    height: ${size}px;
                                    border-radius: 50%;
                                    background: ${color};
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-weight: bold;
                                    font-size: ${Math.max(0.8, size / 50)}rem;
                                    color: #000;
                                    box-shadow: 0 4px 12px ${color}80, inset 0 2px 4px rgba(255,255,255,0.3);
                                    border: 2px solid ${color};
                                    position: relative;
                                ">
                                    P${result.position}
                                </div>
                                <div style="font-size: 1.2rem; margin-top: 0.5rem;">${getCircuitFlag(result.circuit)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : ''}

        ${raceResults.length > 0 ? `
            <div>
                <h4 style="color: #ccc; margin-bottom: 1.5rem;">Race Results</h4>
                <div style="display: flex; align-items: center; justify-content: space-around; position: relative; padding: 2rem 0;">
                    <!-- Connection line -->
                    <div style="position: absolute; top: 50%; left: 5%; right: 5%; height: 2px; background: linear-gradient(90deg, ${teamColor}40 0%, ${teamColor}20 50%, ${teamColor}40 100%); z-index: 0;"></div>

                    ${raceResults.slice(-8).map(result => {
                        const isDNF = result.dnf || result.dns;
                        // Size based on position: P1 = 70px, P20 = 30px, DNF = 35px
                        const size = isDNF ? 35 : Math.max(30, 70 - (result.position * 2));
                        const color = result.dnf ? '#ff0000' : result.dns ? '#666' : result.position <= 3 ? '#00ff88' : result.position <= 10 ? teamColor : '#666';
                        const label = result.dnf ? 'DNF' : result.dns ? 'DNS' : `P${result.position}`;
                        const fontSize = isDNF ? '0.75rem' : `${Math.max(0.8, size / 50)}rem`;
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; z-index: 1;">
                                <div style="
                                    width: ${size}px;
                                    height: ${size}px;
                                    border-radius: 50%;
                                    background: ${color};
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-weight: bold;
                                    font-size: ${fontSize};
                                    color: #000;
                                    box-shadow: 0 4px 12px ${color}80, inset 0 2px 4px rgba(255,255,255,0.3);
                                    border: 2px solid ${color};
                                    position: relative;
                                    ${isDNF ? 'opacity: 0.7;' : ''}
                                ">
                                    ${label}
                                </div>
                                <div style="font-size: 1.2rem; margin-top: 0.5rem;">${getCircuitFlag(result.circuit)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : ''}

        ${qualiResults.length === 0 && raceResults.length === 0 ? `
            <div style="text-align: center; color: #666; padding: 2rem;">
                No recent results available for this driver
            </div>
        ` : ''}
    `;
}

function closeDriverModal() {
    document.getElementById('driver-modal').style.display = 'none';
}

// Close modal on outside click
window.onclick = function(event) {
    const modal = document.getElementById('driver-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Initialize on page load
init();
