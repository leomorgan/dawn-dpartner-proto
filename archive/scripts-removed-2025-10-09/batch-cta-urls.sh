#!/bin/bash

# Batch CTA generation for multiple URLs
# Usage: ./scripts/batch-cta-urls.sh <url1> <url2> ...

if [ $# -eq 0 ]; then
    echo "Usage: ./scripts/batch-cta-urls.sh <url1> <url2> ..."
    echo "Example: ./scripts/batch-cta-urls.sh https://monzo.com https://revolut.com"
    exit 1
fi

echo "🚀 Batch CTA generation starting for $# URLs..."
echo ""

SUCCESS=0
FAILED=0
RESULTS=()

for url in "$@"; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Processing: $url"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Call the API
    RESPONSE=$(curl -s -X POST http://localhost:3000/api/generate-cta \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$url\"}")

    # Check if successful
    if echo "$RESPONSE" | grep -q '"runId"'; then
        RUN_ID=$(echo "$RESPONSE" | grep -o '"runId":"[^"]*"' | cut -d'"' -f4)
        echo "✅ Success: $url"
        echo "   Run ID: $RUN_ID"
        SUCCESS=$((SUCCESS + 1))
        RESULTS+=("✅ $url → $RUN_ID")
    else
        ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo "❌ Failed: $url"
        echo "   Error: ${ERROR:-Unknown error}"
        FAILED=$((FAILED + 1))
        RESULTS+=("❌ $url → Failed")
    fi

    echo ""

    # Add delay to avoid overwhelming the server
    sleep 2
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Batch Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total URLs: $#"
echo "✅ Successful: $SUCCESS"
echo "❌ Failed: $FAILED"
echo ""

if [ ${#RESULTS[@]} -gt 0 ]; then
    echo "Results:"
    printf '%s\n' "${RESULTS[@]}"
fi

echo ""

if [ $FAILED -gt 0 ]; then
    exit 1
fi
