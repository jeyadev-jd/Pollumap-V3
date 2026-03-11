import requests

url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImU1NjAxMzdkNmRhMjQzNTViMGQ1ZTJmMWNlMTUwMDJhIiwiaCI6Im11cm11cjY0In0='
}
payload = {
    "coordinates": [[80.2707, 13.0827], [80.2435, 12.9716]],
    "alternative_routes": {
        "share_factor": 0.6,
        "target_count": 3
    }
}

try:
    response = requests.post(url, headers=headers, json=payload, timeout=5)
    print("Status:", response.status_code)
    print("Response:", response.text[:200])
except Exception as e:
    print("Error:", e)
