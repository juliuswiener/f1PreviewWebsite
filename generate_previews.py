#!/usr/bin/env python3
"""
Generate F1 race weekend previews using OpenAI API
"""

import json
import os
from openai import OpenAI

# Configuration
CIRCUIT = "singapore"
RACE_DATE = "2025-10-05"
SEASON = "2025"
MODEL = "gpt-5"
MAX_OUTPUT_TOKENS = 30000

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

prompts = {
    "race_context": """Provide race weekend context for the {circuit} Grand Prix on {raceDate} in {season}. Include:
- Weather forecast (temperature, rain probability, wind)
- Track characteristics and key corners
- Historical safety car statistics at this circuit
- Strategy considerations (tire compounds, pit stop windows)
- Recent race history at this circuit (last 3 years)
- Any unique challenges this circuit presents

Keep it concise and factual. Return the response as JSON.""",

    "driver_preview": """Write a "what to look for with {driverName}" text for the upcoming F1 {circuit} GP.

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
}""",

    "top5": """Based on these driver previews and race context, identify the TOP 5 DRIVERS TO WATCH for this race weekend.

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
]""",

    "underdogs": """Identify 3 UNDERDOG STORIES for this race weekend.

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
]"""
}


def call_openai(client, prompt, use_json_format=True):
    """Call OpenAI Responses API"""
    request_body = {
        "model": MODEL,
        "input": prompt,
        "max_output_tokens": MAX_OUTPUT_TOKENS,
    }

    if use_json_format:
        request_body["text"] = {
            "format": {
                "type": "json_object"
            }
        }

    response = client.responses.create(**request_body)

    # Extract text from response
    for item in response.output:
        if item.type == 'message':
            for part in item.content:
                if part.type in ['text', 'output_text']:
                    return part.text.strip()

    raise Exception("No text found in response")


def main():
    # Initialize OpenAI client
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable not set")
        return

    client = OpenAI(api_key=api_key)

    print(f"Generating previews for {CIRCUIT} GP on {RACE_DATE}...")

    # Step 1: Generate race context
    print("\n1. Generating race context...")
    race_context_prompt = prompts["race_context"].format(
        circuit=CIRCUIT,
        raceDate=RACE_DATE,
        season=SEASON
    )
    race_context = call_openai(client, race_context_prompt)
    print(f"   ✓ Race context generated ({len(race_context)} chars)")

    # Step 2: Generate driver previews
    print(f"\n2. Generating {len(drivers_2025)} driver previews...")
    driver_previews = {}

    for i, driver in enumerate(drivers_2025, 1):
        print(f"   [{i}/{len(drivers_2025)}] {driver['name']}...", end=" ")

        driver_prompt = prompts["driver_preview"].format(
            driverName=driver["name"],
            driverNumber=driver["number"],
            team=driver["team"],
            circuit=CIRCUIT,
            raceContext=race_context
        )

        try:
            preview_text = call_openai(client, driver_prompt)
            preview = json.loads(preview_text)
            driver_previews[driver["name"]] = preview
            print("✓")
        except Exception as e:
            print(f"✗ Error: {e}")
            driver_previews[driver["name"]] = {
                "tldr": "Error generating preview",
                "full": str(e),
                "stakes_level": "medium"
            }

    # Step 3: Generate top 5
    print("\n3. Generating top 5 analysis...")
    top5_prompt = prompts["top5"] + "\n\nDriver Previews:\n" + json.dumps(driver_previews, indent=2) + "\n\nRace Context:\n" + race_context

    top5_text = call_openai(client, top5_prompt)
    top5 = json.loads(top5_text)
    print(f"   ✓ Top 5 generated")

    # Step 4: Generate underdogs
    print("\n4. Generating underdog stories...")
    underdogs_prompt = prompts["underdogs"] + "\n\nDriver Previews:\n" + json.dumps(driver_previews, indent=2) + "\n\nRace Context:\n" + race_context

    underdogs_text = call_openai(client, underdogs_prompt)
    underdogs = json.loads(underdogs_text)
    print(f"   ✓ Underdog stories generated")

    # Compile results
    result = {
        "drivers": driver_previews,
        "top5": top5,
        "underdogs": underdogs,
        "raceContext": race_context,
        "metadata": {
            "circuit": CIRCUIT,
            "date": RACE_DATE,
            "season": SEASON,
            "generatedAt": None  # Will be set by JS when loaded
        }
    }

    # Save to file
    output_file = "preview_data.json"
    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n✅ All done! Preview data saved to {output_file}")
    print(f"\nTo use: Upload {output_file} to your website and load it via JavaScript")


if __name__ == "__main__":
    main()
