#!/usr/bin/env python3
"""
Generate F1 race weekend previews using OpenAI API

Usage:
  python generate_previews.py                           # Generate all sections
  python generate_previews.py --only=prediction         # Only generate race prediction
  python generate_previews.py --only=top5               # Only generate top 5
  python generate_previews.py --only=underdogs          # Only generate underdogs
  python generate_previews.py --only=standings          # Only generate standings data
  python generate_previews.py --only=drivers            # Only regenerate all driver profiles
  python generate_previews.py --only=driver --driver="Max Verstappen"  # Regenerate single driver
"""

import asyncio
import json
import os
import sys
import base64
import argparse
from datetime import datetime
from openai import AsyncOpenAI

# Configuration - Leave None to auto-detect next GP
CIRCUIT = None  # e.g., "singapore" or None for auto-detect
RACE_DATE = None  # e.g., "2025-10-05" or None for auto-detect
SEASON = "2025"
MODEL = "gpt-5"
MAX_OUTPUT_TOKENS = 30000
ENABLE_WEB_SEARCH = True  # Enable GPT-5 to search for latest race data, weather, results

# Session results (if available) - UPDATE THIS MANUALLY
# Set to None if session hasn't happened yet
SESSION_RESULTS = {
    "fp1": None,  # Free Practice 1 results
    "fp2": None,  # Free Practice 2 results
    "fp3": None,  # Free Practice 3 results
    "sprint_qualifying": None,  # Sprint Qualifying (if sprint weekend)
    "sprint": None,  # Sprint Race (if sprint weekend)
    "qualifying": None,  # Main Qualifying results
    # Example format:
    # "fp1": "P1: Verstappen, P2: Norris, P3: Leclerc. Red flags: 1 (Stroll crash T7). Key: Mercedes struggling with balance.",
    # "qualifying": "P1: Norris (1:29.525), P2: Verstappen (+0.203), P3: Hamilton (+0.421). Out in Q2: Perez, Tsunoda. Conditions: Dry, 28°C track temp.",
}

drivers_2025 = [
    {"name": "Max Verstappen", "team": "Red Bull", "number": 1},
    {"name": "Yuki Tsunoda", "team": "Red Bull", "number": 22},
    {"name": "Lewis Hamilton", "team": "Ferrari", "number": 44},
    {"name": "Charles Leclerc", "team": "Ferrari", "number": 16},
    {"name": "Lando Norris", "team": "McLaren", "number": 4},
    {"name": "Oscar Piastri", "team": "McLaren", "number": 81},
    {"name": "George Russell", "team": "Mercedes", "number": 63},
    {"name": "Kimi Antonelli", "team": "Mercedes", "number": 12},
    {"name": "Fernando Alonso", "team": "Aston Martin", "number": 14},
    {"name": "Lance Stroll", "team": "Aston Martin", "number": 18},
    {"name": "Pierre Gasly", "team": "Alpine", "number": 10},
    {"name": "Franco Colapinto", "team": "Alpine", "number": 45},
    {"name": "Esteban Ocon", "team": "Haas", "number": 31},
    {"name": "Oliver Bearman", "team": "Haas", "number": 87},
    {"name": "Alex Albon", "team": "Williams", "number": 23},
    {"name": "Carlos Sainz", "team": "Williams", "number": 55},
    {"name": "Liam Lawson", "team": "Racing Bulls", "number": 30},
    {"name": "Isack Hadjar", "team": "Racing Bulls", "number": 6},
    {"name": "Nico Hulkenberg", "team": "Sauber", "number": 27},
    {"name": "Gabriel Bortoleto", "team": "Sauber", "number": 5},
]

def get_session_context():
    """Build a summary of completed sessions"""
    completed = {k: v for k, v in SESSION_RESULTS.items() if v is not None}

    if not completed:
        return None

    session_names = {
        "fp1": "FP1",
        "fp2": "FP2",
        "fp3": "FP3",
        "sprint_qualifying": "Sprint Qualifying",
        "sprint": "Sprint Race",
        "qualifying": "Qualifying"
    }

    context = "COMPLETED SESSIONS THIS WEEKEND:\n\n"
    for session_key, results in completed.items():
        context += f"**{session_names.get(session_key, session_key.upper())}:**\n{results}\n\n"

    return context.strip()


prompts = {
    "race_context": """Search for and provide race weekend context for the {circuit} Grand Prix on {raceDate} in {season}.

IMPORTANT: Use web search to find the LATEST information about:
- Current weather forecast for the race weekend
- Any recent practice/qualifying session results if the weekend has started
- Latest F1 news and developments

Provide a comprehensive race context summary including:
- Weather forecast (temperature, rain probability, wind)
- Track characteristics and key corners
- Historical safety car statistics at this circuit
- Strategy considerations (tire compounds, pit stop windows)
- Recent race history at this circuit (last 3 years)
- Any unique challenges this circuit presents

Keep it factual and informative - this will be used to brief preview writers.""",

    "driver_preview": """Write a "what to look for with {driverName}" preview for the upcoming F1 {circuit} GP.

Driver: {driverName} (#{driverNumber})
Team: {team}

IMPORTANT: Use web search to find {driverName}'s:
- Latest race results and current form (last 3-5 races in {season})
- Recent news, incidents, or statements
- Practice/qualifying results if this race weekend has started

Race Context:
{raceContext}

{sessionContext}

Consider:
- Current form and recent results this season (last 5 races)
- Previous performance at this circuit (if applicable)
- Car setup considerations for this track
- Stakes (championship position, career implications, contract situation)
- Driver strengths and weaknesses relevant to this circuit
- What would be a good/perfect result (qualifying and race)
- What has the driver has to deal with off the track (contract, penalties, rivals, personal)
- What technical updates/changes has the team planned
- Have they struggled recently with something specific
- What have they recently said about the car
- **IF SESSION RESULTS PROVIDED**: How this driver performed in completed sessions (practice/qualifying) and what it means for the race

Format your response EXACTLY as follows:

FULL: [Write in clean, structured markdown format with the following sections:

## Current Form
[2-3 sentences on recent race results, championship position, and momentum]

## Circuit History & Strengths
[2-3 sentences on past performance here and why their driving style suits/doesn't suit this track. Include 2-3 key strengths relevant to this circuit.]

## Situation
[2-3 sentences on the current situation for the driver. What do they have to deal with]

## Chances
[2-3 sentences on what they can gain here. What are the chances they can capitalize on.]

## This Weekend's Brief
[2-3 sentences on specific goals, strategy considerations, and what a good result looks like]

## The Stakes
[1-2 sentences on what this race means for championship, contract, or team dynamics]

## What to Watch For
[1-2 sentences on the one specific thing to watch for this driver this weekend]
]

STAKES: [high/medium/low]

PERFECT_QUALI: [e.g., "P1-P3" or "Pole position"]
PERFECT_RACE: [e.g., "Podium finish" or "Victory"]
GOOD_QUALI: [e.g., "P4-P6" or "Top 10"]
GOOD_RACE: [e.g., "Points finish" or "P6-P8"]""",

    "top5": """Based on these driver previews and race context, identify the TOP 5 DRIVERS TO WATCH for the upcoming race.

{sessionContext}

Consider:
- Championship stakes (title fight, team battles)
- Pressure situations (contract year, recent struggles/success)
- Current form (hot streak, redemption arc)
- Track-specific advantages (historical performance, driving style match)
- Storylines (rivalries, milestones, team dynamics)
- **IF SESSION RESULTS PROVIDED**: Performance in completed sessions (practice/qualifying) and grid positions

Format EXACTLY as follows for each of the 5 drivers:

#1: [Driver Name]
REASON: [1-2 compelling sentences explaining why they're must-watch]
STAKES: [What's on the line for this driver]

#2: [Driver Name]
REASON: [1-2 compelling sentences explaining why they're must-watch]
STAKES: [What's on the line for this driver]

[Continue for #3, #4, #5]

Driver Previews:
{driverPreviews}

Race Context:
{raceContext}""",

    "underdogs": """Identify 3 UNDERDOG STORIES for the upcoming race.

{sessionContext}

An underdog story should feature drivers who:
- Could surprise with performance above expectations
- Have something significant to prove
- Face adversity or a unique opportunity
- Are flying under the radar but could shine
- Have track-specific advantages not widely recognized
- **IF SESSION RESULTS PROVIDED**: Showed promise in practice/qualifying despite lower expectations

Format EXACTLY as follows for each of the 3 underdogs:

UNDERDOG #1: [Driver Name]
TITLE: [Catchy 5-7 word story title]
STORY: [2-3 sentence narrative explaining why this is compelling]
SURPRISE_FACTOR: [Why they could overperform this weekend]

UNDERDOG #2: [Driver Name]
TITLE: [Catchy 5-7 word story title]
STORY: [2-3 sentence narrative explaining why this is compelling]
SURPRISE_FACTOR: [Why they could overperform this weekend]

UNDERDOG #3: [Driver Name]
TITLE: [Catchy 5-7 word story title]
STORY: [2-3 sentence narrative explaining why this is compelling]
SURPRISE_FACTOR: [Why they could overperform this weekend]

Driver Previews:
{driverPreviews}

Race Context:
{raceContext}""",

    "prediction": """Based on these detailed driver previews for the {circuit} Grand Prix on {raceDate}, provide your race weekend predictions.

{sessionContext}

Driver Previews:
{driverPreviews}

Race Context:
{raceContext}

Provide predictions in markdown format as a numbered list including:
1. **Qualifying Top 3** - Who will take pole, P2, P3 and why
2. **Race Podium** - Predicted race winner and podium finishers with reasoning
3. **Driver of the Weekend** - Who will have the standout performance
4. **Dark Horse** - Which driver could surprise and outperform expectations
5. **Key Battle** - The most exciting head-to-head fight to watch
6. **Bold Prediction** - One surprising or controversial prediction

Be specific, use driver names, and explain your reasoning based on the preview data."""
}


async def call_openai(client, prompt, enable_search=True):
    """Call OpenAI Responses API asynchronously"""
    request_body = {
        "model": MODEL,
        "input": prompt,
        "max_output_tokens": MAX_OUTPUT_TOKENS,
    }

    # Enable web search for GPT-5
    if enable_search and ENABLE_WEB_SEARCH and MODEL.startswith("gpt-5"):
        request_body["tools"] = [{"type": "web_search"}]

    response = await client.responses.create(**request_body)

    # Extract text from response
    for item in response.output:
        if item.type == 'message':
            for part in item.content:
                if part.type in ['text', 'output_text']:
                    return part.text.strip()

    raise Exception("No text found in response")


def clean_urls(text):
    """Remove all URLs and URL markdown from text"""
    import re
    # Remove markdown links [text](url)
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove bare URLs
    text = re.sub(r'https?://[^\s\)]+', '', text)
    # Remove remaining URL references in parentheses like (domain.com) or (www.domain.com)
    text = re.sub(r'\s*\([a-zA-Z0-9\-\.]+\.(com|org|net|co\.uk|io|gov|edu)[^\)]*\)', '', text)
    return text.strip()


def parse_driver_preview(text):
    """Parse structured driver preview text into dict"""
    import re

    # Clean URLs from text first
    text = clean_urls(text)

    preview = {}

    # Extract FULL
    full_match = re.search(r'FULL:\s*(.+?)(?=\s*(?:STAKES:|PERFECT_QUALI:|GOOD_QUALI:))', text, re.DOTALL)
    preview['full'] = full_match.group(1).strip() if full_match else ""

    # Extract STAKES
    stakes_match = re.search(r'STAKES:\s*(\w+)', text)
    preview['stakes_level'] = stakes_match.group(1).lower() if stakes_match else "medium"

    # Extract qualifying/race expectations
    perfect_quali_match = re.search(r'PERFECT_QUALI:\s*(.+?)(?=\n)', text)
    preview['perfect_quali'] = perfect_quali_match.group(1).strip() if perfect_quali_match else ""

    perfect_race_match = re.search(r'PERFECT_RACE:\s*(.+?)(?=\n)', text)
    preview['perfect_race'] = perfect_race_match.group(1).strip() if perfect_race_match else ""

    good_quali_match = re.search(r'GOOD_QUALI:\s*(.+?)(?=\n)', text)
    preview['good_quali'] = good_quali_match.group(1).strip() if good_quali_match else ""

    good_race_match = re.search(r'GOOD_RACE:\s*(.+?)(?=\n|$)', text)
    preview['good_race'] = good_race_match.group(1).strip() if good_race_match else ""

    return preview


def parse_top5(text):
    """Parse top 5 text into list of dicts"""
    import re

    # Clean URLs from text first
    text = clean_urls(text)

    top5 = []

    # Find all driver entries (#1 through #5)
    pattern = r'#(\d+):\s*(.+?)\nREASON:\s*(.+?)\nSTAKES:\s*(.+?)(?=\n\n|#\d+:|$)'
    matches = re.finditer(pattern, text, re.DOTALL)

    for match in matches:
        rank = int(match.group(1))
        driver = match.group(2).strip()
        reason = match.group(3).strip()
        stakes = match.group(4).strip()

        top5.append({
            "rank": rank,
            "driver": driver,
            "reason": reason,
            "stakes": stakes
        })

    return sorted(top5, key=lambda x: x['rank'])


def parse_underdogs(text):
    """Parse underdogs text into list of dicts"""
    import re

    # Clean URLs from text first
    text = clean_urls(text)

    underdogs = []

    # Find all underdog entries
    pattern = r'UNDERDOG #\d+:\s*(.+?)\nTITLE:\s*(.+?)\nSTORY:\s*(.+?)\nSURPRISE_FACTOR:\s*(.+?)(?=\n\n|UNDERDOG #|$)'
    matches = re.finditer(pattern, text, re.DOTALL)

    for match in matches:
        driver = match.group(1).strip()
        title = match.group(2).strip()
        story = match.group(3).strip()
        surprise_factor = match.group(4).strip()

        underdogs.append({
            "driver": driver,
            "title": title,
            "story": story,
            "surprise_factor": surprise_factor
        })

    return underdogs


async def generate_driver_preview_async(client, driver, circuit, race_context, session_context, season):
    """Generate a single driver preview asynchronously"""
    driver_prompt = prompts["driver_preview"].format(
        driverName=driver["name"],
        driverNumber=driver["number"],
        team=driver["team"],
        circuit=circuit,
        season=season,
        raceContext=race_context,
        sessionContext=session_context or ""
    )

    try:
        preview_text = await call_openai(client, driver_prompt)
        preview = parse_driver_preview(preview_text)
        return driver["name"], preview, None
    except Exception as e:
        return driver["name"], {
            "tldr": "Error generating preview",
            "full": str(e),
            "stakes_level": "medium"
        }, str(e)


async def detect_next_gp(client):
    """Auto-detect the next Grand Prix using web search"""
    print("\n🔍 Auto-detecting next Grand Prix...")

    prompt = """Search for the next Formula 1 Grand Prix race.

    Return ONLY a JSON object with this exact format:
    {
        "circuit": "circuit name (e.g., 'singapore', 'monaco', 'silverstone')",
        "race_date": "YYYY-MM-DD",
        "gp_name": "Full GP name (e.g., 'Singapore Grand Prix', 'Monaco Grand Prix')"
    }

    Use today's date to determine which is the NEXT upcoming race."""

    response = await call_openai(client, prompt)

    try:
        # Try to extract JSON from response
        import re
        json_match = re.search(r'\{[^{}]*\}', response)
        if json_match:
            data = json.loads(json_match.group())
            return data.get("circuit"), data.get("race_date"), data.get("gp_name")
    except Exception as e:
        print(f"   ⚠ Could not auto-detect GP: {e}")
        print(f"   Response: {response[:200]}")

    return None, None, None

async def generate_gp_header_image(client, circuit, gp_name):
    """Generate a header image for the Grand Prix"""
    print("\n🎨 Generating GP header image...")

    prompt = f"""Create a dramatic, cinematic header image for the {gp_name}.

Style: Modern F1 aesthetic with dynamic lighting, showing the iconic elements of {circuit} circuit.
Include: Track elements, atmosphere of the location, F1 cars in motion blur.
Mood: Exciting, professional, high-energy racing atmosphere.
Composition: Wide landscape banner suitable for website header.
No text or logos - pure visual imagery with dark tones."""

    try:
        response = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",  # Landscape format for dall-e-3
            quality="hd",
            style="vivid",
            n=1
        )

        # Extract image URL and download
        if response.data and len(response.data) > 0:
            image_url = response.data[0].url

            # Download the image
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url) as img_response:
                    if img_response.status == 200:
                        image_bytes = await img_response.read()
                        with open("gp_header.png", "wb") as f:
                            f.write(image_bytes)
                        print(f"   ✓ Header image saved to gp_header.png")
                        return True
                    else:
                        print(f"   ✗ Failed to download image: HTTP {img_response.status}")
                        return False
        else:
            print(f"   ✗ No image data returned")
            return False
    except Exception as e:
        print(f"   ✗ Image generation failed: {e}")
        return False


def load_existing_data(json_file="preview_data.json"):
    """Load existing preview data from JSON file"""
    if not os.path.exists(json_file):
        print(f"   ✗ {json_file} not found. Generate full data first.")
        return None

    with open(json_file, 'r') as f:
        data = json.load(f)

    print(f"   ✓ Loaded existing data from {json_file}")
    return data


def get_preview_summary(preview):
    """Extract a brief summary from the full preview text"""
    import re

    # Get just the "Current Form" section as a summary
    full_text = preview.get('full', '')
    current_form_match = re.search(r'## Current Form\s*\n(.+?)(?=\n##|\n\n##|$)', full_text, re.DOTALL)

    if current_form_match:
        return current_form_match.group(1).strip()

    # Fallback: return first 200 characters
    return full_text[:200].strip() if full_text else ""


async def generate_prediction_only(client, json_file="preview_data.json"):
    """Generate only race prediction using existing data"""
    print("\n📊 Generating race prediction from existing data...")

    data = load_existing_data(json_file)
    if not data:
        return

    # Get session context
    session_context = get_session_context()

    # Format driver previews
    driver_previews_text = "\n\n".join([
        f"**{name}** ({data['drivers'][name].get('stakes_level', 'medium')} stakes):\n{preview.get('full', '')}\n\nPerfect Result: Quali {preview.get('perfect_quali', 'N/A')}, Race {preview.get('perfect_race', 'N/A')}\nGood Result: Quali {preview.get('good_quali', 'N/A')}, Race {preview.get('good_race', 'N/A')}"
        for name, preview in data['drivers'].items()
    ])

    prediction_prompt = prompts["prediction"].format(
        circuit=data['metadata']['circuit'],
        raceDate=data['metadata']['date'],
        sessionContext=session_context or "",
        driverPreviews=driver_previews_text,
        raceContext=data['raceContext']
    )

    prediction_text = await call_openai(client, prediction_prompt)
    prediction = clean_urls(prediction_text)

    # Update data
    data['prediction'] = prediction

    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"   ✓ Race prediction generated and saved to {json_file}")


async def generate_top5_only(client, json_file="preview_data.json"):
    """Generate only top 5 using existing data"""
    print("\n🏆 Generating top 5 analysis from existing data...")

    data = load_existing_data(json_file)
    if not data:
        return

    # Get session context
    session_context = get_session_context()

    # Format driver previews
    driver_previews_text = "\n\n".join([
        f"{name}:\n{get_preview_summary(preview)}"
        for name, preview in data['drivers'].items()
    ])

    top5_prompt = prompts["top5"].format(
        sessionContext=session_context or "",
        driverPreviews=driver_previews_text,
        raceContext=data['raceContext']
    )

    top5_text = await call_openai(client, top5_prompt)
    top5 = parse_top5(top5_text)

    # Update data
    data['top5'] = top5

    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"   ✓ Top 5 analysis generated and saved to {json_file}")


async def generate_underdogs_only(client, json_file="preview_data.json"):
    """Generate only underdogs using existing data"""
    print("\n⚡ Generating underdog stories from existing data...")

    data = load_existing_data(json_file)
    if not data:
        return

    # Get session context
    session_context = get_session_context()

    # Format driver previews
    driver_previews_text = "\n\n".join([
        f"{name}:\n{get_preview_summary(preview)}"
        for name, preview in data['drivers'].items()
    ])

    underdogs_prompt = prompts["underdogs"].format(
        sessionContext=session_context or "",
        driverPreviews=driver_previews_text,
        raceContext=data['raceContext']
    )

    underdogs_text = await call_openai(client, underdogs_prompt)
    underdogs = parse_underdogs(underdogs_text)

    # Update data
    data['underdogs'] = underdogs

    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"   ✓ Underdog stories generated and saved to {json_file}")


async def generate_standings_only(json_file="preview_data.json"):
    """Generate only standings data using F1 API"""
    print("\n📈 Generating standings data from F1 API...")

    data = load_existing_data(json_file)
    if not data:
        return

    import aiohttp

    # Determine current season and latest round
    season = data['metadata'].get('season', SEASON)

    async with aiohttp.ClientSession() as session:
        # Get current season data
        async with session.get(f'https://f1api.dev/api/current') as response:
            if response.status != 200:
                print(f"   ✗ Failed to fetch current season data")
                return

            current_data = await response.json()
            completed_races = [r for r in current_data['races'] if r.get('winner') is not None]
            latest_round = len(completed_races)

        print(f"   ℹ Found {latest_round} completed rounds")

        # Calculate cumulative points for each round
        driver_points = {}
        standings_data = {}

        for round_num in range(1, latest_round + 1):
            async with session.get(f'https://f1api.dev/api/{season}/{round_num}/race') as response:
                if response.status != 200:
                    continue

                race_data = await response.json()

                if race_data.get('races', {}).get('results'):
                    for result in race_data['races']['results']:
                        driver_name = f"{result['driver']['name']} {result['driver']['surname']}"
                        display_name = 'Kimi Antonelli' if driver_name == 'Andrea Kimi Antonelli' else driver_name

                        if display_name not in driver_points:
                            driver_points[display_name] = 0

                        driver_points[display_name] += result.get('points', 0)

                        if display_name not in standings_data:
                            standings_data[display_name] = {
                                'positions': [],
                                'team': result['team']['teamName'],
                                'number': result['driver']['number']
                            }

                    # Calculate standings for this round
                    round_standings = sorted(
                        [{'name': name, 'points': points} for name, points in driver_points.items()],
                        key=lambda x: x['points'],
                        reverse=True
                    )

                    # Assign positions
                    for idx, standing in enumerate(round_standings):
                        if standing['name'] in standings_data:
                            standings_data[standing['name']]['positions'].append({
                                'round': round_num,
                                'position': idx + 1
                            })

            print(f"   ✓ Processed round {round_num}/{latest_round}")

    # Update data
    data['standings'] = {
        'standingsData': standings_data,
        'latestRound': latest_round
    }

    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"   ✓ Standings data generated and saved to {json_file}")


async def generate_single_driver_only(client, driver_name, json_file="preview_data.json"):
    """Generate only a single driver profile using existing data"""
    print(f"\n👤 Regenerating profile for {driver_name}...")

    data = load_existing_data(json_file)
    if not data:
        return

    # Find driver in drivers_2025 list
    driver = next((d for d in drivers_2025 if d['name'] == driver_name), None)
    if not driver:
        print(f"   ✗ Driver '{driver_name}' not found in drivers list")
        print(f"   Available drivers: {', '.join([d['name'] for d in drivers_2025])}")
        return

    # Get session context
    session_context = get_session_context()

    # Generate preview
    circuit = data['metadata']['circuit']
    race_date = data['metadata']['date']
    season = data['metadata']['season']
    race_context = data['raceContext']

    _, preview, error = await generate_driver_preview_async(
        client, driver, circuit, race_context, session_context, season
    )

    if error:
        print(f"   ✗ Failed to generate preview: {error}")
        return

    # Update only this driver in data
    data['drivers'][driver_name] = preview

    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"   ✓ {driver_name} profile regenerated and saved to {json_file}")


async def generate_all_drivers_only(client, json_file="preview_data.json"):
    """Generate only all driver profiles using existing data"""
    print(f"\n👥 Regenerating all {len(drivers_2025)} driver profiles...")

    data = load_existing_data(json_file)
    if not data:
        return

    # Get session context
    session_context = get_session_context()

    # Get metadata
    circuit = data['metadata']['circuit']
    race_date = data['metadata']['date']
    season = data['metadata']['season']
    race_context = data['raceContext']

    # Create tasks for all drivers
    tasks = [
        generate_driver_preview_async(client, driver, circuit, race_context, session_context, season)
        for driver in drivers_2025
    ]

    # Run all tasks concurrently
    results = await asyncio.gather(*tasks)

    # Process results
    driver_previews = {}
    for driver_name, preview, error in results:
        driver_previews[driver_name] = preview
        if error:
            print(f"   ✗ {driver_name}: {error}")
        else:
            print(f"   ✓ {driver_name}")

    # Update drivers in data
    data['drivers'] = driver_previews

    # Save updated data
    with open(json_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"   ✓ All {len(driver_previews)} driver profiles regenerated and saved to {json_file}")

async def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(
        description="Generate F1 race weekend previews",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_previews.py                              # Generate everything
  python generate_previews.py --only=prediction            # Only generate race prediction
  python generate_previews.py --only=top5                  # Only regenerate top 5
  python generate_previews.py --only=underdogs             # Only regenerate underdogs
  python generate_previews.py --only=standings             # Only regenerate standings
  python generate_previews.py --only=drivers               # Only regenerate all driver profiles
  python generate_previews.py --only=driver --driver="Max Verstappen"  # Regenerate single driver
        """
    )
    parser.add_argument(
        '--only',
        choices=['prediction', 'top5', 'underdogs', 'standings', 'drivers', 'driver'],
        help='Generate only a specific section using existing data'
    )
    parser.add_argument(
        '--driver',
        type=str,
        help='Driver name when using --only=driver (e.g., "Max Verstappen")'
    )
    parser.add_argument(
        '--json',
        default='preview_data.json',
        help='Path to preview data JSON file (default: preview_data.json)'
    )

    args = parser.parse_args()

    # Validate driver argument
    if args.only == 'driver' and not args.driver:
        print("Error: --driver argument is required when using --only=driver")
        print(f"Available drivers: {', '.join([d['name'] for d in drivers_2025])}")
        return

    # Initialize OpenAI client (not needed for standings-only)
    api_key = os.environ.get("OPENAI_API_KEY")
    client = None

    if args.only != 'standings':
        if not api_key:
            print("Error: OPENAI_API_KEY environment variable not set")
            return
        client = AsyncOpenAI(api_key=api_key)

    # Handle --only mode
    if args.only:
        if args.only == 'prediction':
            await generate_prediction_only(client, args.json)
        elif args.only == 'top5':
            await generate_top5_only(client, args.json)
        elif args.only == 'underdogs':
            await generate_underdogs_only(client, args.json)
        elif args.only == 'standings':
            await generate_standings_only(args.json)
        elif args.only == 'drivers':
            await generate_all_drivers_only(client, args.json)
        elif args.only == 'driver':
            await generate_single_driver_only(client, args.driver, args.json)
        return

    # Auto-detect next GP if not specified
    global CIRCUIT, RACE_DATE
    gp_name = None

    if CIRCUIT is None or RACE_DATE is None:
        detected_circuit, detected_date, detected_name = await detect_next_gp(client)
        if detected_circuit and detected_date:
            CIRCUIT = detected_circuit
            RACE_DATE = detected_date
            gp_name = detected_name
            print(f"   ✓ Detected: {gp_name} on {RACE_DATE}")
        else:
            print("   ✗ Auto-detection failed. Please set CIRCUIT and RACE_DATE manually.")
            return

    print(f"\nGenerating previews for {CIRCUIT} GP on {RACE_DATE}...")

    # Generate header image
    if gp_name:
        await generate_gp_header_image(client, CIRCUIT, gp_name)

    # Check for web search capability
    if ENABLE_WEB_SEARCH and MODEL.startswith("gpt-5"):
        print(f"\n🌐 Web search ENABLED - Model will search for latest race data, weather, and results")
    else:
        print(f"\n📝 Web search DISABLED - Using model's training data only")

    # Check for session results
    session_context = get_session_context()
    if session_context:
        print(f"\n📊 Including results from completed sessions:")
        completed_sessions = [k for k, v in SESSION_RESULTS.items() if v is not None]
        print(f"   {', '.join(completed_sessions)}")
    else:
        print("\n📅 No manual session results provided")

    # Step 1: Generate race context
    print("\n1. Generating race context...")
    race_context_prompt = prompts["race_context"].format(
        circuit=CIRCUIT,
        raceDate=RACE_DATE,
        season=SEASON
    )
    race_context_raw = await call_openai(client, race_context_prompt)
    race_context = clean_urls(race_context_raw)
    print(f"   ✓ Race context generated ({len(race_context)} chars)")

    # Step 2: Generate driver previews in parallel
    print(f"\n2. Generating {len(drivers_2025)} driver previews in parallel...")

    # Create tasks for all drivers
    tasks = [
        generate_driver_preview_async(client, driver, CIRCUIT, race_context, session_context, SEASON)
        for driver in drivers_2025
    ]

    # Run all tasks concurrently
    results = await asyncio.gather(*tasks)

    # Process results
    driver_previews = {}
    for driver_name, preview, error in results:
        driver_previews[driver_name] = preview
        if error:
            print(f"   ✗ {driver_name}: {error}")
        else:
            print(f"   ✓ {driver_name}")

    print(f"   ✓ All {len(driver_previews)} driver previews generated")

    # Step 3: Generate top 5
    print("\n3. Generating top 5 analysis...")

    # Format driver previews as readable text for the prompt
    driver_previews_text = "\n\n".join([
        f"{name}:\n{get_preview_summary(preview)}"
        for name, preview in driver_previews.items()
    ])

    top5_prompt = prompts["top5"].format(
        sessionContext=session_context or "",
        driverPreviews=driver_previews_text,
        raceContext=race_context
    )

    top5_text = await call_openai(client, top5_prompt)
    top5 = parse_top5(top5_text)
    print(f"   ✓ Top 5 generated")

    # Step 4: Generate underdogs
    print("\n4. Generating underdog stories...")
    underdogs_prompt = prompts["underdogs"].format(
        sessionContext=session_context or "",
        driverPreviews=driver_previews_text,
        raceContext=race_context
    )

    underdogs_text = await call_openai(client, underdogs_prompt)
    underdogs = parse_underdogs(underdogs_text)
    print(f"   ✓ Underdog stories generated")

    # Step 5: Generate race prediction
    print("\n5. Generating race prediction...")

    # Format full driver previews for prediction
    full_driver_previews_text = "\n\n".join([
        f"**{name}** ({preview.get('stakes_level', 'medium')} stakes):\n{preview.get('full', '')}\n\nPerfect Result: Quali {preview.get('perfect_quali', 'N/A')}, Race {preview.get('perfect_race', 'N/A')}\nGood Result: Quali {preview.get('good_quali', 'N/A')}, Race {preview.get('good_race', 'N/A')}"
        for name, preview in driver_previews.items()
    ])

    prediction_prompt = prompts["prediction"].format(
        circuit=CIRCUIT,
        raceDate=RACE_DATE,
        sessionContext=session_context or "",
        driverPreviews=full_driver_previews_text,
        raceContext=race_context
    )

    prediction_text = await call_openai(client, prediction_prompt)
    prediction = clean_urls(prediction_text)
    print(f"   ✓ Race prediction generated")

    # Step 6: Generate standings data
    print("\n6. Generating championship standings data...")

    import aiohttp

    async with aiohttp.ClientSession() as session:
        # Get current season data
        async with session.get(f'https://f1api.dev/api/current') as response:
            if response.status == 200:
                current_data = await response.json()
                completed_races = [r for r in current_data['races'] if r.get('winner') is not None]
                latest_round = len(completed_races)

                print(f"   ℹ Found {latest_round} completed rounds")

                # Calculate cumulative points for each round
                driver_points = {}
                standings_data = {}

                for round_num in range(1, latest_round + 1):
                    async with session.get(f'https://f1api.dev/api/{SEASON}/{round_num}/race') as race_response:
                        if race_response.status != 200:
                            continue

                        race_data = await race_response.json()

                        if race_data.get('races', {}).get('results'):
                            for result in race_data['races']['results']:
                                driver_name = f"{result['driver']['name']} {result['driver']['surname']}"
                                display_name = 'Kimi Antonelli' if driver_name == 'Andrea Kimi Antonelli' else driver_name

                                if display_name not in driver_points:
                                    driver_points[display_name] = 0

                                driver_points[display_name] += result.get('points', 0)

                                if display_name not in standings_data:
                                    standings_data[display_name] = {
                                        'positions': [],
                                        'team': result['team']['teamName'],
                                        'number': result['driver']['number']
                                    }

                            # Calculate standings for this round
                            round_standings = sorted(
                                [{'name': name, 'points': points} for name, points in driver_points.items()],
                                key=lambda x: x['points'],
                                reverse=True
                            )

                            # Assign positions
                            for idx, standing in enumerate(round_standings):
                                if standing['name'] in standings_data:
                                    standings_data[standing['name']]['positions'].append({
                                        'round': round_num,
                                        'position': idx + 1
                                    })

                standings = {
                    'standingsData': standings_data,
                    'latestRound': latest_round
                }
                print(f"   ✓ Championship standings data generated")
            else:
                print(f"   ✗ Failed to fetch standings data")
                standings = None

    # Compile results
    result = {
        "drivers": driver_previews,
        "top5": top5,
        "underdogs": underdogs,
        "prediction": prediction,
        "raceContext": race_context,
        "metadata": {
            "circuit": CIRCUIT,
            "date": RACE_DATE,
            "season": SEASON,
            "generatedAt": None  # Will be set by JS when loaded
        }
    }

    # Add standings if generated
    if standings:
        result["standings"] = standings

    # Save to file
    output_file = "preview_data.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n✅ All done! Preview data saved to {output_file}")
    print(f"\nTo use: Upload {output_file} to your website and load it via JavaScript")


if __name__ == "__main__":
    asyncio.run(main())
