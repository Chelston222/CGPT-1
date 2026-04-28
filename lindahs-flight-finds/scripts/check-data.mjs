import { deals, runQualityChecks } from '../data/deals.js';

const failures = [];

for (const check of runQualityChecks()) {
  if (!check.pass) failures.push(check.name);
}

if (!deals.length) failures.push('No deals found');

for (const deal of deals) {
  if (!deal.slug) failures.push(`${deal.id}: missing slug`);
  if (!deal.itinerary?.length) failures.push(`${deal.id}: missing itinerary`);
  if (!deal.socialSlides?.length) failures.push(`${deal.id}: missing social slides`);
  if (!deal.caption) failures.push(`${deal.id}: missing caption`);
  if (!deal.emailSubject) failures.push(`${deal.id}: missing email subject`);
}

if (failures.length) {
  console.error('Data check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Data check passed for ${deals.length} deals.`);
