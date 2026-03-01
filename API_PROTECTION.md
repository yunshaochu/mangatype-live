# API Protection Feature

## Overview

Automatic API endpoint protection that detects rate limit errors (429, 503, etc.) and implements exponential backoff with auto-disable functionality.

## Features

### 1. Error Detection
- Detects HTTP status codes: 429, 503, 502, 504
- Detects error messages containing: "rate limit", "too many requests", "quota exceeded", "service unavailable"

### 2. Exponential Backoff
When an endpoint encounters a protectable error, it's automatically paused with increasing durations:
- 1st error: 30 seconds (default)
- 2nd error: 1 minute (default)
- 3rd error: 2 minutes (default)
- 4th error: 5 minutes (default)
- 5th error: 10 minutes (default, triggers auto-disable)

**Customizable**: Users can configure pause durations in Settings → API Endpoints → ⚙️ (gear icon)

### 3. Auto-Disable
By default, the 5th consecutive error triggers auto-disable. This threshold is configurable (1-10 errors).

### 4. Success Reset
When an endpoint successfully completes a request, its error count is reset to 0, pause is cleared, and all error indicators are removed.

## Configuration

### Access Settings
Click the gear icon (⚙️) next to "Add Endpoint" button in Settings → API Endpoints

### Available Options

1. **Enable API Protection** (default: ON)
   - Toggle to enable/disable the entire protection system

2. **Pause Durations** (default: 30, 60, 120, 300, 600 seconds)
   - Configure pause time for each error (1st through 5th)
   - Minimum: 1 second per duration

3. **Auto-Disable Threshold** (default: 5)
   - Which consecutive error number triggers auto-disable
   - Range: 1-10 errors

4. **Reset to Defaults**
   - Restore all settings to default values

## Implementation

### Data Model (types.ts)
```typescript
export interface APIEndpoint {
  // ... existing fields
  pausedUntil?: number; // Timestamp when endpoint can be used again
  consecutiveErrors?: number; // Count of consecutive errors
  lastError?: string; // Last error message
}
```

### Core Service (services/apiProtection.ts)
- `isProtectableError()` - Detects if error should trigger protection
- `calculatePauseDuration()` - Calculates exponential backoff duration
- `handleEndpointError()` - Updates endpoint after error
- `handleEndpointSuccess()` - Resets endpoint after success
- `isEndpointPaused()` - Checks if endpoint is currently paused
- `getRemainingPauseTime()` - Gets remaining pause time in seconds
- `formatPauseDuration()` - Formats duration for display

### Integration (hooks/useProcessor.ts)
- `runDetectionForImage()` now accepts `endpointId` parameter
- On success: calls `handleEndpointSuccess()` to reset error count
- On error: calls `handleEndpointError()` to apply backoff/disable
- `processQueue()` filters out paused endpoints before starting
- Workers check pause status before processing each image

### UI (components/settings/ProviderTab.tsx)
Displays endpoint status:
- 🕐 Orange badge: Shows remaining pause time (only when paused)
- ⚠️ Red badge: Shows consecutive error count (only when paused)
- Error message: Displays last error below endpoint name (only when paused)
- All error indicators are cleared when:
  - Endpoint successfully completes a request
  - Pause timer expires
  - User manually re-enables the endpoint

## Usage

No configuration needed - the feature works automatically:

1. **Normal Operation**: Endpoints work as usual
2. **Rate Limit Hit**: Endpoint pauses for 30s
3. **Repeated Errors**: Pause duration increases exponentially (30s → 1m → 2m → 4m → 10m)
4. **Auto-Disable**: Only the 5th error (10m pause) triggers auto-disable
5. **Success Recovery**: Successful request resets error count and clears all indicators

## Example Scenarios

### Scenario 1: Temporary Rate Limit
```
Request 1: 429 error → Pause 30s
[30s wait]
Request 2: Success → Reset, back to normal
```

### Scenario 2: Persistent Issues
```
Request 1: 429 error → Pause 30s
Request 2: 429 error → Pause 1m
Request 3: 503 error → Pause 2m
Request 4: 429 error → Pause 5m
Request 5: 429 error → Pause 10m + Auto-disable
```

### Scenario 3: Recovery After Errors
```
Request 1: 429 error → Pause 30s (consecutiveErrors: 1)
Request 2: 429 error → Pause 1m (consecutiveErrors: 2)
Request 3: Success → Reset (consecutiveErrors: 0, all indicators cleared)
Request 4: 429 error → Pause 30s (starts from 1st error again)
```

### Scenario 4: Multiple Endpoints
```
Endpoint A: Paused (2m remaining, shows orange badge)
Endpoint B: Active
Endpoint C: Active

→ Batch processing uses only B and C
→ After 2m, A becomes available again (all indicators cleared)
```

## Benefits

1. **Prevents API Bans**: Automatically backs off when hitting rate limits
2. **Cost Savings**: Avoids wasting quota on repeated failed requests
3. **Reliability**: Continues processing with other endpoints
4. **User-Friendly**: Visual feedback on endpoint status
5. **Self-Healing**: Automatically recovers after successful requests

## Technical Notes

- Pause state is stored in localStorage (persists across sessions)
- Pause checks happen before each image processing
- Workers poll every 1s when endpoint is paused
- Auto-disable threshold: 5th consecutive error (10 minutes pause)
- Error detection is case-insensitive and checks both status codes and messages
- Error indicators (badges, messages) are only shown when endpoint is paused
- Manual re-enable clears all error state

## Testing Tool

A built-in test tool is available in Settings → API Endpoints.

**Note**: The test tool is hidden by default. Enable it in API Protection Settings (⚙️ gear icon) → "Show Test Tool"

### Test Scenarios:
1. **Single Error (30s)** - Simulates one 429 error
2. **Repeated Errors (3x)** - Simulates 3 consecutive errors (30s → 1m → 2m)
3. **Success Recovery** - Tests error → error → success → error flow
4. **Auto-Disable (5x)** - Simulates 5 consecutive errors to trigger auto-disable

### Features:
- No real API calls - completely simulated
- No token consumption
- Real-time status updates in UI
- Reset button to clear test state
- Detailed step-by-step results
- Respects custom pause durations and disable threshold from settings

Use this tool to verify the protection mechanism works correctly before deploying to production.
