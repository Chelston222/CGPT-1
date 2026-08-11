# QA gates

A master is not client-ready until all hard gates pass.

## Automated hard gates
- valid HTML document scaffold
- viewport metadata
- Apple message reformat protection
- table-based presentation structure
- 600px desktop container with fluid mobile behaviour
- unsubscribe mechanism
- logo token and primary CTA token
- ALT attribute on every image
- no scripts, iframes, forms or javascript URLs
- no dependency on CSS flexbox or grid
- dark-mode metadata
- Outlook/MSO markers

## Human hard gates before a real send
- approved client logo and branding
- all placeholder tokens resolved
- desktop, mobile and dark-mode previews
- images-off state checked
- links and UTM parameters verified
- unsubscribe/manage-preferences behaviour verified
- dynamic product/order/event data tested against the actual client integration
- truthful claims and genuine urgency only
- controlled seed email received and inspected
- sending-domain health confirmed
- audience, suppression and flow logic confirmed

## Recommended render matrix
Prioritise the client’s real audience, with at least Gmail web/mobile, Apple Mail/iOS Mail, Outlook desktop/web, and Yahoo where material.

## Accessibility
- body copy normally 16px or larger
- descriptive ALT where imagery carries meaning
- layout tables use `role="presentation"`
- visible CTA labels state the action
- reasonable contrast
- critical information remains live text
- logical mobile reading order
