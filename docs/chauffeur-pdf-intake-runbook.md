# Chauffeur PDF intake runbook

The one-shot workflow is triggered only by an owner-created issue titled exactly:

`[IMAP PDF INTAKE] rs-li-chauffeur-open-quote-recovery-001`

On success it:
1. authenticates to `hello@222emails.com` using the existing repository secret;
2. retrieves the exact Gmail-delivered PDF attachment;
3. verifies filename, sender, subject, byte count, PDF signature and SHA-256;
4. reconstructs through the governed PDF intake code;
5. verifies 10 pages and the locked digest;
6. runs the existing PDF/media regression tests;
7. commits governed media and queue revision 1;
8. verifies the public raw PDF is byte-identical;
9. records a `[PDF INTAKE READY]` audit issue.

The separate repository-owner `[APPROVED LINKEDIN]` issue remains mandatory before Buffer mutation.
