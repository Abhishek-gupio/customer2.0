#!/bin/bash

# Generates a dummy webhook payload simulating Damoov
# and sends it to the local backend.

DAMOOV_WEBHOOK_SECRET="test_secret_123"

# Find a vehicleId to link first (replace with actual from DB if you want to test end-to-end)
# We will just test the webhook endpoint handling the payload.
INSTANCE_ID="e331f9cd-e3e1-4a47-9d4b-67cf324ed300"

echo "Sending Damoov webhook payload with signature..."

curl -X POST http://localhost:9000/api/v1/telematics/webhook \
  -H "Content-Type: application/json" \
  -H "x-damoov-signature: $DAMOOV_WEBHOOK_SECRET" \
  -d '{
    "InstanceID": "'$INSTANCE_ID'",
    "TripID": "TEST_TRIP_'$RANDOM'",
    "StartDate": '$(date -v -30M +%s 2>/dev/null || date -d "30 mins ago" +%s)',
    "EndDate": '$(date +%s)',
    "Distance": 12.5,
    "Duration": 1800,
    "Score_Overall": 85,
    "Events": [
        {
            "Type": "HARSH_BRAKING",
            "Date": '$(date -v -15M +%s 2>/dev/null || date -d "15 mins ago" +%s)',
            "Latitude": 28.7041,
            "Longitude": 77.1025,
            "Value": 0.8,
            "Speed": 45
        }
    ]
}'

echo ""
echo "Webhook sent."
