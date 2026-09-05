# Chauffeur PDF intake owner gate

The IMAP transport trigger and the Buffer publication approval are deliberately separate owner actions.

Transport trigger title:
`[IMAP PDF INTAKE] rs-li-chauffeur-open-quote-recovery-001`

Publication approval title prefix:
`[APPROVED LINKEDIN]`

The first moves exact bytes into the governed queue. The second is created only after the locked queue revision has been read back and matched exactly.
