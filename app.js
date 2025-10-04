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
2. FULL: Detailed informational text (150-200 words)

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
            const raceSubtitle = document.getElementById('race-subtitle');

            if (data.metadata) {
                const circuitName = data.metadata.circuit || 'Unknown';
                const season = data.metadata.season || '2025';
                const date = data.metadata.date || '';

                raceTitle.textContent = `${circuitName.toUpperCase()} GP ${season}`;
                raceSubtitle.textContent = `Race Weekend: ${date}`;
                raceInfo.style.display = 'block';
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

function initializeDriverGrid() {
    const grid = document.getElementById('driver-grid');
    grid.innerHTML = drivers2025.map(driver => {
        const hasPreview = generatedData.drivers[driver.name];
        const statusClass = hasPreview ? 'generated' : '';
        const statusBadge = hasPreview ? '✓' : '';

        // Get stakes level and color
        const stakesLevel = hasPreview?.stakes_level || 'medium';
        const stakesColors = {
            'high': '#ff0000',
            'medium': '#ffaa00',
            'low': '#00ff88'
        };
        const stakesColor = stakesColors[stakesLevel] || stakesColors['medium'];

        return `
            <div class="driver-card ${statusClass}" id="card-${driver.number}" onclick="viewDriver('${driver.name}')">
                <div class="status-badge">${statusBadge}</div>
                <div style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;">#${driver.number}</div>
                <div style="font-size: 1.1rem; font-weight: 600;">${driver.name}</div>
                <div style="color: #999; margin-top: 0.3rem;">${driver.team}</div>
                ${hasPreview ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: ${stakesColor}; text-transform: uppercase; font-weight: bold;">⚡ ${stakesLevel} stakes</div>` : ''}
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

function getDriverImageUrl(driverName) {
    // Map of driver names to their team and code for 2025
    const driverInfo = {
        'Max Verstappen': { team: 'redbull', code: 'maxver01' },
        'Yuki Tsunoda': { team: 'redbull', code: 'yuktsu01' },
        'Lewis Hamilton': { team: 'ferrari', code: 'lewham01' },
        'Charles Leclerc': { team: 'ferrari', code: 'chalec01' },
        'Lando Norris': { team: 'mclaren', code: 'lannor01' },
        'Oscar Piastri': { team: 'mclaren', code: 'oscpia01' },
        'George Russell': { team: 'mercedes', code: 'georus01' },
        'Kimi Antonelli': { team: 'mercedes', code: 'kimant01' },
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
        'Nico Hulkenberg': { team: 'sauber', code: 'nichul01' },
        'Gabriel Bortoleto': { team: 'sauber', code: 'gabbor01' }
    };

    const info = driverInfo[driverName];
    if (!info) return 'https://www.formula1.com/content/dam/fom-website/2018-redesign-assets/drivers/number-logo/GENERIC.png';

    return `https://media.formula1.com/image/upload/c_lfill,w_440/q_auto/d_common:f1:2025:fallback:driver:2025fallbackdriverright.webp/v1740000000/common/f1/2025/${info.team}/${info.code}/2025${info.team}${info.code}right.webp`;
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

    content.innerHTML = `
        <div class="highlight-section">
            <h3>🏆 Top 5 Drivers to Watch - ${circuitName.toUpperCase()} GP ${season}</h3>
            ${top5Data.map((item, i) => `
                <div class="top-driver-item">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <img src="${getDriverImageUrl(item.driver)}"
                             alt="${item.driver}"
                             style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; object-position: center 15%; border: 2px solid #0096ff;"
                             onerror="this.style.display='none'">
                        <h4 style="margin: 0;">#${item.rank || i + 1} ${item.driver}</h4>
                    </div>
                    <p><strong>Why watch:</strong> ${item.reason}</p>
                    ${item.stakes ? `<p style="color: #4db8ff; margin-top: 0.5rem;"><strong>Stakes:</strong> ${item.stakes}</p>` : ''}
                    <a href="#" onclick="viewDriver('${item.driver}'); return false;" style="color: #0096ff; margin-top: 0.5rem; display: inline-block;">→ View full preview</a>
                </div>
            `).join('')}
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

    content.innerHTML = `
        <div class="highlight-section">
            <h3>🔥 Underdog Stories - ${circuitName.toUpperCase()} GP ${season}</h3>
            ${underdogsData.map((item, i) => `
                <div class="top-driver-item">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <img src="${getDriverImageUrl(item.driver)}"
                             alt="${item.driver}"
                             style="width: 70px; height: 70px; border-radius: 50%; object-fit: cover; object-position: center 15%; border: 2px solid #ff8800;"
                             onerror="this.style.display='none'">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.25rem 0;">${item.driver}</h4>
                            <p style="margin: 0; color: #ff8800; font-size: 0.95rem; font-style: italic;">${item.title}</p>
                        </div>
                    </div>
                    <p>${item.story}</p>
                    ${item.surprise_factor ? `<p style="color: #00ff88; margin-top: 0.5rem;"><strong>Surprise Factor:</strong> ${item.surprise_factor}</p>` : ''}
                    <a href="#" onclick="viewDriver('${item.driver}'); return false;" style="color: #0096ff; margin-top: 0.5rem; display: inline-block;">→ View full preview</a>
                </div>
            `).join('')}
        </div>
    `;
}

function viewDriver(driverName) {
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

    modalContent.innerHTML = `
        <div class="driver-preview">
            <h3>TL;DR</h3>
            <div class="tldr">${preview.tldr}</div>

            <h3 style="margin-top: 1.5rem;">Full Analysis</h3>
            <div class="full-text">${preview.full}</div>

            <div style="margin-top: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: rgba(0, 255, 0, 0.1); padding: 1rem; border-radius: 6px;">
                    <strong style="color: #00ff88;">Perfect Weekend:</strong><br>
                    Quali: ${preview.perfect_quali || 'N/A'}<br>
                    Race: ${preview.perfect_race || 'N/A'}
                </div>
                <div style="background: rgba(255, 165, 0, 0.1); padding: 1rem; border-radius: 6px;">
                    <strong style="color: #ffaa00;">Good Weekend:</strong><br>
                    Quali: ${preview.good_quali || 'N/A'}<br>
                    Race: ${preview.good_race || 'N/A'}
                </div>
            </div>

            ${preview.key_strengths ? `
                <div style="margin-top: 1rem;">
                    <strong>Key Strengths:</strong> ${preview.key_strengths.join(', ')}
                </div>
            ` : ''}

            ${preview.watch_for ? `
                <div style="margin-top: 1rem; background: rgba(225, 6, 0, 0.1); padding: 1rem; border-radius: 6px;">
                    <strong style="color: #ff1e00;">🔍 Watch For:</strong> ${preview.watch_for}
                </div>
            ` : ''}

            <div style="margin-top: 1rem; text-align: center; color: #666;">
                Stakes Level: <span style="color: ${preview.stakes_level === 'high' ? '#ff0000' : preview.stakes_level === 'medium' ? '#ffaa00' : '#00ff88'}; text-transform: uppercase; font-weight: bold;">${preview.stakes_level || 'Medium'}</span>
            </div>
        </div>
    `;

    modal.style.display = 'block';
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
