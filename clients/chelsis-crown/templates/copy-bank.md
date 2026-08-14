# Chelsi's Crown Core Flow Copy Bank

Status: pre-account staging. Replace placeholders only after confirmed booking/service details arrive.

## F01 New Interest Welcome

### Message 1 — You're in
Subject: You’re on the Chelsi’s Crown list
Preview: Appointment updates, useful guidance and the clearest next step.

Hi {{ first_name|default:'there' }},

You’re now on the Chelsi’s Crown priority list.

You’ll hear about relevant appointment availability, pop-up updates and practical guidance around preparing for and looking after your style.

If you already know what you want, you can view the current booking route below.

CTA: View availability

### Message 2 — Choosing the right next step
Subject: Not sure what to book?
Preview: A simple way to choose your next Chelsi’s Crown appointment.

Hi {{ first_name|default:'there' }},

If you’re deciding between services, the easiest next step is to start with the result you want and any maintenance needs from your current style.

Once Chelsi’s current service list and consultation route are confirmed, this message will dynamically point people to the correct option rather than forcing everyone through the same journey.

CTA: Explore options

### Message 3 — Low-pressure booking prompt
Subject: Ready when you are
Preview: Your next Chelsi’s Crown appointment can start here.

Hi {{ first_name|default:'there' }},

Just a final note in case you joined the list because you were considering an appointment.

If now is the right time, the current booking route is below. If not, there’s nothing else you need to do.

CTA: View availability

## F02 Enquiry Recovery

### Message 1
Subject: Your Chelsi’s Crown enquiry
Preview: Here’s the clearest next step.

Hi {{ first_name|default:'there' }},

Thanks for getting in touch with Chelsi’s Crown.

If you have not booked yet, use the route below to continue. If your question needs Chelsi personally, the journey should hand over rather than keep sending automated prompts.

CTA: Continue your enquiry

### Message 2
Subject: Still deciding?
Preview: A little help before you choose.

Hi {{ first_name|default:'there' }},

If something is holding you back from booking, it is usually easier to resolve that before choosing a slot.

Once Chelsi’s confirmed FAQs, service prices and preparation requirements arrive, this message will surface the most useful answers here.

CTA: View service information

### Message 3
Subject: Closing the loop on your enquiry
Preview: No pressure, just the booking route if you still need it.

Hi {{ first_name|default:'there' }},

I’ll close the loop after this message so you are not repeatedly chased.

If you still want to book, the current route is below.

CTA: View availability

## F03 Appointment Preparation

### T-3 days
Subject: Getting ready for your Chelsi’s Crown appointment
Preview: Your preparation checklist before the appointment.

Hi {{ first_name|default:'there' }},

Your appointment is coming up.

This message will contain Chelsi’s confirmed preparation instructions, arrival guidance and any service-specific requirements before launch.

CTA: Review appointment details

### T-1 day
Subject: A quick reminder for tomorrow
Preview: The practical details for your Chelsi’s Crown appointment.

Hi {{ first_name|default:'there' }},

A quick reminder ahead of your appointment tomorrow. Please review the confirmed preparation and arrival information below.

If anything has changed, use the approved contact or rescheduling route rather than replying to an unmonitored address.

CTA: View appointment details

## F04 Aftercare

### +2 hours
Subject: Looking after your new style
Preview: Your Chelsi’s Crown aftercare guidance.

Hi {{ first_name|default:'there' }},

Thank you for choosing Chelsi’s Crown.

Your service-specific aftercare guidance will live here once Chelsi confirms it. The aim is to make the information easy to find again rather than relying on memory after the appointment.

CTA: Save your aftercare guide

### +48 hours
Subject: How are you getting on?
Preview: A simple Chelsi’s Crown check-in.

Hi {{ first_name|default:'there' }},

Just checking in after your appointment.

If everything is going well, there is nothing you need to do. If something genuinely needs Chelsi’s attention, this message should route you to a human rather than trying to automate a sensitive concern.

CTA: Contact Chelsi’s Crown

## F05 Review + Referral

### +72 hours
Subject: How was your Chelsi’s Crown experience?
Preview: Your feedback helps future clients choose with confidence.

Hi {{ first_name|default:'there' }},

If you are happy with your experience, would you be willing to leave a short review?

It helps future clients understand what to expect before booking.

CTA: Leave a review

### +7 days
Subject: Know someone who would love Chelsi’s Crown?
Preview: Feel free to pass this on.

Hi {{ first_name|default:'there' }},

If someone comes to mind who would genuinely suit Chelsi’s Crown, you are welcome to share the booking or enquiry route with them.

No incentive or referral promise is assumed unless Chelsi explicitly introduces one later.

CTA: Share Chelsi’s Crown

## F06 Maintenance + Rebooking

### 14 days before expected return
Subject: It may be time to plan your next appointment
Preview: Get ahead of your next maintenance window.

Hi {{ first_name|default:'there' }},

Based on the timing of your previous appointment, you may be approaching the point where it makes sense to plan your next visit.

Booking ahead gives you more choice without creating false urgency.

CTA: View availability

### Due now
Subject: Your next Chelsi’s Crown visit may be due
Preview: Your maintenance timing has arrived.

Hi {{ first_name|default:'there' }},

Your expected return window is around now.

If you are ready to plan the next appointment, use the booking route below.

CTA: View availability

### 14 days overdue
Subject: Still need your next appointment?
Preview: One final reminder, then we’ll leave it with you.

Hi {{ first_name|default:'there' }},

A final reminder in case your next appointment slipped down the list.

If you have already booked elsewhere, changed plans or simply do not need anything yet, no action is required.

CTA: View availability

## F07 Lapsed Recovery

### Message 1
Subject: It’s been a little while
Preview: If you’re thinking about your next style, here’s the route back.

Hi {{ first_name|default:'there' }},

It has been a little while since your last recorded Chelsi’s Crown appointment.

If you have been meaning to come back, the current route is below. If your plans have changed, there is no need to do anything.

CTA: View availability

### Message 2
Subject: Planning your next style?
Preview: A useful reminder if you have been considering it.

Hi {{ first_name|default:'there' }},

If you are thinking about your next style or maintenance appointment, you can use the route below to see what Chelsi’s Crown currently offers.

CTA: Explore options

### Message 3
Subject: We’ll leave it with you
Preview: Your booking route is here whenever you need it.

Hi {{ first_name|default:'there' }},

This is the final reactivation message in this sequence.

We would rather stop than keep sending reminders that are not useful. If you want to return later, Chelsi’s Crown will still be here.

CTA: View availability

## F08 Cancellation Fill
Subject: An appointment space has opened
Preview: Genuine last-minute availability from Chelsi’s Crown.

Hi {{ first_name|default:'there' }},

A genuine appointment space has become available at [DATE/TIME].

If that timing suits you and the slot is still open, use the approved booking route below. Once filled, the message should no longer be sent.

CTA: Check the slot

## F09 Pop-up Journey

Copy stays blocked until the real event date, location, capacity, service scope and booking route are confirmed. No invented scarcity or invented capacity language.

## F10 Sunset

### Message 1
Subject: Still want to hear from Chelsi’s Crown?
Preview: A quick preference check.

Hi {{ first_name|default:'there' }},

We have not seen much engagement from you recently and do not want to keep sending messages you do not need.

If you still want relevant Chelsi’s Crown updates, use the confirmation link below.

CTA: Keep me subscribed

### Message 2
Subject: We’ll stop the regular updates
Preview: You can always come back later.

Hi {{ first_name|default:'there' }},

We will stop regular marketing updates unless you choose to stay subscribed.

You can always return to Chelsi’s Crown directly whenever you need it.

CTA: Keep me subscribed
