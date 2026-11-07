#!/usr/bin/env bash
# Push the Fola agent and its webhook tools to ElevenLabs.
# Usage: ./push.sh https://your-public-backend.example.com
# Run from anywhere. Needs the elevenlabs CLI, authenticated (auth login or ELEVENLABS_API_KEY).
set -euo pipefail
cd "$(dirname "$0")"

BASE="${1:?Usage: ./push.sh https://your-public-backend-url (no trailing slash)}"
BASE="${BASE%/}"
PLACEHOLDER="https://API_BASE_URL"

# 1. Swap the placeholder base URL into every tool config.
for f in tool_configs/*.json; do
  python3 - "$f" "$PLACEHOLDER" "$BASE" <<'EOF'
import sys
p, old, new = sys.argv[1:4]
s = open(p).read()
open(p, "w").write(s.replace(old, new))
EOF
done
echo "Base URL set to $BASE in tool_configs/"

# 2. Push the tools (creates new ones; the CLI records their ids in tools.json).
elevenlabs tools push

# 3. Link the tool ids into the agent config (prompt.tool_ids).
python3 - <<'EOF'
import json
tools = json.load(open("tools.json"))["tools"]
ids, missing = [], []
for t in tools:
    (ids if t.get("id") else missing).append(t.get("id") or t["config"])
if missing:
    raise SystemExit("These tools have no id in tools.json after 'tools push': %s\n"
                     "Create them with 'elevenlabs tools add <name> --config-path <copy>' and copy the id across, then re-run." % missing)
p = "agent_configs/fola.json"
cfg = json.load(open(p))
cfg["conversation_config"]["agent"]["prompt"]["tool_ids"] = ids
json.dump(cfg, open(p, "w"), indent=4)
open(p, "a").write("\n")
print("Linked %d tool ids into %s" % (len(ids), p))
EOF

# 4. Push the agent (creates it on first push; the id lands in agents.json).
elevenlabs agents push
elevenlabs agents status

AGENT_ID=$(python3 -c 'import json;print(json.load(open("agents.json"))["agents"][0].get("id",""))')
echo "Agent id: ${AGENT_ID}"
echo "Widget snippet:"
elevenlabs agents widget embed "$AGENT_ID"
