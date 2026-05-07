'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  appConfig,
  average,
  deals,
  money,
  riskTone,
  saving,
  seoPages,
  trustItems
} from '../data/deals';

const SORT_OPTIONS = {
  score: (a, b) => b.score - a.score,
  priceLow: (a, b) => a.price - b.price,
  savingHigh: (a, b) => saving(b) - saving(a),
  riskLow: (a, b) => a.risk - b.risk
};

function trackEvent(event, payload) {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...payload })
  }).catch(() => {});
}

export default function LindahFlightFindsClient() {
  const [query, setQuery] = useState('');
  const [tripType, setTripType] = useState('All');
  const [maxPrice, setMaxPrice] = useState('Any');
  const [sortBy, setSortBy] = useState('score');
  const [selectedSlug, setSelectedSlug] = useState(deals[0]?.slug ?? '');
  const [compareSlugs, setCompareSlugs] = useState([]);

  const types = ['All', ...new Set(deals.map((deal) => deal.type))];
  const maxPriceOptions = ['Any', '40', '60', '80', '120'];
  const filteredDeals = deals
    .filter((deal) => {
      const matchesQuery =
        !query ||
        [deal.title, deal.from, deal.to, deal.country, deal.type]
          .join(' ')
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesType = tripType === 'All' || deal.type === tripType;
      const matchesPrice = maxPrice === 'Any' || deal.price <= Number(maxPrice);
      return matchesQuery && matchesType && matchesPrice;
    })
    .sort(SORT_OPTIONS[sortBy]);

  const selectedDeal =
    filteredDeals.find((deal) => deal.slug === selectedSlug) ||
    filteredDeals[0] ||
    deals[0];
  const compareDeals = deals.filter((deal) => compareSlugs.includes(deal.slug));
  const topScore = filteredDeals.length ? average(filteredDeals.map((deal) => deal.score)) : 0;
  const avgRisk = filteredDeals.length ? average(filteredDeals.map((deal) => deal.risk)) : 0;
  const avgSaving = filteredDeals.length ? average(filteredDeals.map((deal) => saving(deal))) : 0;

  function selectDeal(slug) {
    setSelectedSlug(slug);
    trackEvent('deal_selected', { slug });
  }

  function toggleCompare(slug) {
    setCompareSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= 3) return [...current.slice(1), slug];
      return [...current, slug];
    });
    trackEvent('compare_toggled', { slug });
  }

  return (
    <>
      <header className="hero">
        <div className="shell hero-inner">
          <nav className="nav">
            <div className="brand">
              <div className="logo">L</div>
              <div>
                <strong>{appConfig.name}</strong>
                <small>Cheap-flight finds with the plan already done</small>
              </div>
            </div>
            <div className="navlinks">
              <Link href="/itineraries">Itineraries</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/polls">Polls</Link>
              <Link href="/alerts">Alerts</Link>
            </div>
            <Link className="btn btn-white" href="/alerts">Join alerts</Link>
          </nav>

          <div className="hero-grid">
            <div>
              <p className="eyebrow">Creator-led launch preview</p>
              <h1>Cheap flights people can actually turn into trips.</h1>
              <p className="lead">
                Lindah&apos;s shortlist is built around clarity, not just low fares:
                destination, trip shape, trust notes and a ready-to-share itinerary.
              </p>
              <div className="badges">
                <span className="badge soft">Sample pricing clearly labelled</span>
                <span className="badge soft">UK audience-first</span>
                <span className="badge soft">Affiliate-safe structure</span>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <b>{filteredDeals.length}</b>
                  <span>Deals in current view</span>
                </div>
                <div className="metric">
                  <b>{money(avgSaving)}</b>
                  <span>Average sample saving</span>
                </div>
                <div className="metric">
                  <b>{topScore}</b>
                  <span>Average curation score</span>
                </div>
                <div className="metric">
                  <b>{avgRisk}</b>
                  <span>Average risk score</span>
                </div>
              </div>
            </div>

            <div className="feature-card">
              <div className="photo-panel">
                <img src={selectedDeal.image} alt={`${selectedDeal.to} destination preview`} />
                <div className="overlay" />
                <div className="photo-content">
                  <div className="top-row">
                    <span className="badge soft">{selectedDeal.badge}</span>
                    <span className="price-pill">{money(selectedDeal.price)} sample fare</span>
                  </div>
                  <div>
                    <p className="mini">{selectedDeal.from} to {selectedDeal.to}</p>
                    <h2>{selectedDeal.to}</h2>
                    <p>{selectedDeal.summary}</p>
                    <div className="badges">
                      <span className="glass-pill">{selectedDeal.durationDays} days</span>
                      <span className="glass-pill">{selectedDeal.type}</span>
                      <span className="glass-pill">{selectedDeal.transferEase} transfers</span>
                    </div>
                  </div>
                  <div className="top-row">
                    <span className="orange-pill">Save about {money(saving(selectedDeal))}</span>
                    <Link className="btn btn-orange" href={`/deals/${selectedDeal.slug}`}>
                      View curated deal
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="search-card">
          <div className="search-top">
            <div>
              <p className="eyebrow-dark">Launch board</p>
              <h2>Filter the current deal stack</h2>
            </div>
            <div className="notice">Prototype note: all fares shown are sample prices until live QA is complete.</div>
          </div>
          <div className="search-grid">
            <label className="field">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Barcelona, Porto, city break..."
              />
            </label>
            <label className="field">
              <span>Trip type</span>
              <select value={tripType} onChange={(event) => setTripType(event.target.value)}>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Max fare</span>
              <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
                {maxPriceOptions.map((price) => (
                  <option key={price} value={price}>
                    {price === 'Any' ? 'Any price' : `${money(Number(price))} or less`}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Sort by</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="score">Best overall score</option>
                <option value="priceLow">Lowest price</option>
                <option value="savingHigh">Highest saving</option>
                <option value="riskLow">Lowest risk</option>
              </select>
            </label>
            <button className="btn btn-blue" type="button" onClick={() => selectDeal(filteredDeals[0]?.slug ?? deals[0].slug)}>
              Refresh focus
            </button>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow-dark">Curated deals</p>
              <h2>Cheap-flight picks with context built in</h2>
            </div>
            <p>
              Each card is structured to help Lindah decide what is worth sharing and to
              show visitors where the headline fare may hide real trip costs.
            </p>
          </div>

          <div className="deal-grid">
            {filteredDeals.map((deal) => {
              const tone = riskTone(deal.risk);
              const isActive = selectedDeal.slug === deal.slug;
              const isCompared = compareSlugs.includes(deal.slug);

              return (
                <article
                  className={`deal-card${isActive ? ' active' : ''}${isCompared ? ' compared' : ''}`}
                  key={deal.id}
                >
                  <button className="deal-main" type="button" onClick={() => selectDeal(deal.slug)}>
                    <div className="card-img">
                      <img src={deal.image} alt={`${deal.to} view`} />
                      <div className="overlay" />
                      <div className="chips">
                        <span className="badge orange">{deal.badge}</span>
                        <span className={`badge ${tone}`}>Risk {deal.risk}</span>
                      </div>
                      <div className="price-row">
                        <div>
                          <div className="mini">{deal.from} to {deal.to}</div>
                          <div className="price">{money(deal.price)}</div>
                        </div>
                        <div className="saving">
                          <small>{money(deal.typicalPrice)}</small>
                          Save {money(saving(deal))}
                        </div>
                      </div>
                    </div>
                    <div className="deal-body">
                      <h3>{deal.title}</h3>
                      <p>{deal.summary}</p>
                      <div className="info-grid">
                        <div className="info">{deal.durationDays}-day trip</div>
                        <div className="info">{deal.type}</div>
                        <div className="info">Ease {deal.ease}</div>
                        <div className="info">Demand {deal.demand}</div>
                      </div>
                    </div>
                  </button>
                  <div className="card-actions">
                    <button className="btn btn-soft" type="button" onClick={() => toggleCompare(deal.slug)}>
                      {isCompared ? 'Remove compare' : 'Compare'}
                    </button>
                    <Link className="btn btn-blue" href={`/deals/${deal.slug}`}>
                      Open page
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {compareDeals.length > 0 && (
          <section className="section compare">
            <div className="section-head">
              <div>
                <p className="eyebrow-dark">Compare mode</p>
                <h2>Shortlist up to three candidate deals</h2>
              </div>
              <p>
                This helps Lindah compare headline price, effort and trust risk before
                deciding what deserves a post, alert or itinerary push.
              </p>
            </div>
            <div className="compare-grid">
              {compareDeals.map((deal) => (
                <button className="compare-item" key={deal.slug} type="button" onClick={() => selectDeal(deal.slug)}>
                  <span className="badge blue">{deal.to}</span>
                  <h3>{money(deal.price)}</h3>
                  <p>{deal.durationDays}-day {deal.type.toLowerCase()}</p>
                  <p>Saving {money(saving(deal))}</p>
                  <p>Risk {deal.risk} • {deal.transferEase}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="section split">
          <div className="split-grid">
            <div className="split-photo">
              <img src={selectedDeal.image} alt={`${selectedDeal.to} featured deal`} />
              <div className="overlay" />
              <div className="photo-content">
                <span className="badge soft">{selectedDeal.freshness}</span>
                <div>
                  <p className="mini">{selectedDeal.airport} departure</p>
                  <h2>{selectedDeal.to}</h2>
                  <p>{selectedDeal.lindahNote}</p>
                </div>
                <div className="badges">
                  {selectedDeal.bestFor.map((item) => (
                    <span className="glass-pill" key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="split-content">
              <span className="badge orange">Featured review</span>
              <h2>{selectedDeal.title}</h2>
              <p>{selectedDeal.caption}</p>
              <div className="score-grid">
                <div className="score"><b>{selectedDeal.score}</b><span>overall score</span></div>
                <div className="score"><b>{selectedDeal.ease}</b><span>ease</span></div>
                <div className="score"><b>{selectedDeal.demand}</b><span>demand</span></div>
                <div className="score"><b>{selectedDeal.contentScore}</b><span>content appeal</span></div>
                <div className="score"><b>{selectedDeal.risk}</b><span>risk</span></div>
              </div>
              <div className="two-col">
                <div className="panel">
                  <h2>Why it works</h2>
                  {selectedDeal.checks.map((item) => (
                    <div className="check" key={item}>✓ {item}</div>
                  ))}
                </div>
                <div className="panel amber-panel">
                  <h2>Trust notes</h2>
                  <p><strong>Warning:</strong> {selectedDeal.warning}</p>
                  <p><strong>Budget guide:</strong> {selectedDeal.budget}</p>
                  <p><strong>Disclosure:</strong> outbound provider pages should repeat any affiliate relationship clearly.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section studio">
          <div className="itinerary-box">
            <p className="eyebrow-dark">Itinerary pack</p>
            <h2>{selectedDeal.durationDays}-day outline</h2>
            <div className="day-tabs">
              {selectedDeal.itinerary.map(([day]) => (
                <span className="badge blue" key={day}>{day}</span>
              ))}
            </div>
            {selectedDeal.itinerary.map(([day, title, body]) => (
              <div className="check" key={day}>
                <strong>{day}: {title}</strong>
                <br />
                {body}
              </div>
            ))}
          </div>

          <div className="social-card">
            <img src={selectedDeal.image} alt={`${selectedDeal.to} social card`} />
            <div className="social-inner">
              <div>
                <span className="badge soft">Content pack</span>
                <h2>{selectedDeal.to}</h2>
                <p>{selectedDeal.emailSubject}</p>
              </div>
              <div>
                {selectedDeal.socialSlides.map((slide) => (
                  <div className="check" key={slide}>{slide}</div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow-dark">Launch readiness</p>
              <h2>Trust and route coverage</h2>
            </div>
            <p>
              These are the pieces already in the repo that matter for deployment,
              indexing and public trust before any full launch.
            </p>
          </div>
          <div className="launch-grid">
            <div className="panel white">
              <h2>Trust layers</h2>
              {trustItems.map(([title, body]) => (
                <div className="check" key={title}>
                  <strong>{title}</strong>
                  <br />
                  {body}
                </div>
              ))}
            </div>
            <div className="panel white">
              <h2>SEO and utility routes</h2>
              <div className="seo-grid pad-top">
                {seoPages.map((route) => (
                  <div className="route-pill" key={route}>{route}</div>
                ))}
                <div className="route-pill">/sitemap.xml</div>
                <div className="route-pill">/robots.txt</div>
              </div>
            </div>
          </div>
        </section>

        <footer className="footer">
          {appConfig.name} • Launch preview only • Replace sample data, legal text and
          base URL before public promotion
        </footer>
      </main>
    </>
  );
}
