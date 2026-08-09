---
name: Approved LinkedIn post
about: Send an explicitly approved LinkedIn post to Buffer
labels: linkedin-approved
---
POST_ID: tte-li-001
REVISION: 1
CATEGORY: email_revenue_education
TARGETS: personal
MODE: schedule
SCHEDULE_AT: 2026-07-23T08:30:00+01:00
MEDIA_URL:
---
Paste the final approved LinkedIn post here.

Rules:
- Keep the title prefix exactly: [APPROVED LINKEDIN]
- TARGETS: personal, main, secondary, or a comma-separated combination
- MODE: schedule, queue, or draft
- SCHEDULE_AT is required only for schedule mode and should include a timezone offset
- Multi-channel posts may use SCHEDULE_AT_PERSONAL, SCHEDULE_AT_MAIN and SCHEDULE_AT_SECONDARY
- Channel-specific copy may be placed below ---PERSONAL---, ---MAIN--- or ---SECONDARY--- markers
- MEDIA_URL is optional and must be a publicly accessible HTTPS image URL
- Creating this issue is treated as explicit publishing approval
