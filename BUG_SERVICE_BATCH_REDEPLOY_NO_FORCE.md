# Bug: service_batch_redeploy missing --force flag support

## Summary

`service_batch_redeploy` triggers Railway redeploy but does NOT support `--force` flag. When Railway has a cached Docker image build, the redeploy restarts containers on the OLD cached image instead of building a new image.

## Impact

- Changes to source code (e.g., PR #72 with bug fixes) are NOT reflected in deployed containers
- Railway caches the Docker build after first deployment
- Subsequent redeploys just restart containers unless `force rebuild` is manually triggered via dashboard

## Evidence

**PR #72 workflow:**
- Published image: `ghcr.io/ghashtag/trios-trainer-igla:e5cda97b` at 2026-05-01T20:10:41Z ✅
- Commit has all bug fixes A/B/C/E/F/G

**Railway deployment:**
- service_batch_redeploy for acc3/acc4 showed: redeployed=8/9 ✅
- acc0 scarab-acc0 service NOT updated (stayed on cached image :956c6c95)
- Container b4fa9ad151b4 (worker_id a9075132) started on old image, registered at 20:21:24

**Probe 2047 results:**
- attempts=0 (scarab never claimed)
- claimed_at=NULL (old image without Bug G fix)
- final_step=NULL (old image without Bug E fix)
- final_bpb=NULL (old image without Bug E fix)
- started_at/finished_at SET (auto-transitioned, not via scarab)

## Root Cause

Railway's Docker build caching behavior:
1. First deployment → full build from source
2. Subsequent redeploys → reuse cached build unless `force rebuild` is triggered via dashboard
3. The cached build is tied to a specific commit SHA or timestamp
4. service_batch_redeploy with `force_rebuild=true` only tells Railway to redeploy, NOT to invalidate the cache

## Required Fix

Add `--force` flag support to `service_batch_redeploy` tool. When `--force` is specified, the tool should:
1. Trigger Railway's "Force rebuild" option via API (if available)
2. Or provide instructions to manually trigger force rebuild via dashboard
3. Or add an environment variable to the service that Railway detects as "dirty" state (e.g., `BUILD_TIMESTAMP`)

## Workaround (manual)

1. Open Railway dashboard → acc0 → scarab-acc0
2. Settings → Add new env var (e.g., `BUILD_CACHE_BUST=1`)
3. Redeploy → Railway should rebuild with cache invalidated
4. Wait for new container registration (scarabs.registered_at > previous)
5. Run probe for verification

## References

- PR #72: e5cda97b - Reverted, should have triggered cache rebuild but didn't
- Bug: PR #71 regression — service_batch_redeploy deployed old cached image
