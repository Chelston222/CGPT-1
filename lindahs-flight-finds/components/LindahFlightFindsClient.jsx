'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import AlertsSignupForm from './AlertsSignupForm';
import { trackClientEvent } from '../lib/analytics';
import {
  appConfig,
  average,
  blogIdeas,
  deals,
  money,
  nextFiles,
  pollSeed,
  productionReadiness,
  potentialAfterDeploy,
  riskTone,
  runQualityChecks,
  saving,
  seoPages,
  trustItems,
  unique
} from '../data/deals';

export default function LindahFlightFindsClient() {
  const [query, setQuery] = useState('');
  const [airport, setAirport] = useState('Any airport');
  const [tripType, setTripType] = useState('Any trip');
  const [sortBy, setSortBy] = useState('recommended');
  const [selectedSlug, setSelectedSlug] = useState(deals[0].slug);
  const [savedSlugs, setSavedSlugs] = useState([deals[0].slug]);
  const [compareSlugs, setCompareSlugs] = useState([deals[0].slug, deals[3].slug]);
  const [activeDay, setActiveDay] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [poll, setPoll] = useState(pollSeed);
  const [voted, setVoted] = useState('');

  const filteredDeals = useMemo(() => {
    const filtered = deals.filter((deal) => {
      const haystack = `${deal.title} ${deal.from} ${deal.to} ${deal.country} ${deal.type} ${deal.bestFor.join(' ')}`.toLowerCase();
      return haystack.includes(query.toLowerCase()) &&
        (airport === 'Any airport' || deal.from === airport) &&
        (tripType === 'Any trip' || deal.type === tripType);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'price') return a.price - b.price;
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'saving') return saving(b) - saving(a);
      if (sortBy === 'easy') return b.ease - a.ease;
      if (sortBy === 'risk') return a.risk - b.risk;
      if (sortBy === 'content') return b.contentScore - a.contentScore;
      return (b.score + b.demand + b.contentScore - b.risk) - (a.score + a.demand + a.contentScore - a.risk);
    });
  }, [airport, query, sortBy, tripType]);

  const selectedDeal =
    deals.find((deal) => deal.slug === selectedSlug) ||
    filteredDeals[0] ||
    deals[0];
  const comparedDeals = deals.filter((deal) => compareSlugs.includes(deal.slug));
  const savedDeals = deals.filter((deal) => savedSlugs.includes(deal.slug));
  const checks = runQualityChecks();
  const passedChecks = checks.filter((check) => check.pass).length;
  const airports = ['Any airport', ...unique(deals.map((deal) => deal.from))];
  const tripTypes = ['Any trip', ...unique(deals.map((deal) => deal.type))];

  function selectDeal(slug) {
    setSelectedSlug(slug);
    setActiveDay(0);
    setActiveSlide(0);
    trackClientEvent('deal_selected', { slug });
  }

  function toggleSave(slug) {
    setSavedSlugs((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug]
    );
    trackClientEvent('saved_toggled', { slug });
  }

  function toggleCompare(slug) {
    setCompareSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= 3) return [...current.slice(1), slug];
      return [...current, slug];
    });
    trackClientEvent('compare_toggled', { slug });
  }

  function clearFilters() {
    setQuery('');
    setAirport('Any airport');
    setTripType('Any trip');
    setSortBy('recommended');
  }

  function vote(label) {
    if (voted) return;
    setPoll((current) => current.map((item) => (
      item.label === label ? { ...item, votes: item.votes + 1 } : item
    )));
    setVoted(label);
  }

  const totalVotes = poll.reduce((sum, item) => sum + item.votes, 0);
  const heroAvgScore = average(deals.map((deal) => deal.score));

  return (
    <>
      <header className="hero">
        <div className="shell hero-inner">
          <nav className="nav">
            <div className="brand">
              <div className="logo">L</div>
              <div>
                <strong>{appConfig.name}</strong>
                <small>{appConfig.version}</small>
              </div>
            </div>
            <div className="navlinks">
              <a href="#deals">Deals</a>
              <a href="#trip">Trip engine</a>
              <a href="#trust">Trust</a>
              <a href="#launch">Launch</a>
            </div>
            <a className="btn btn-white" href="#alerts">Join alerts</a>
          </nav>

          <div className="hero-grid">
            <div>
              <div className="badges">
                <span className="badge soft">JR7-JR9 consolidated</span>
                <span className="badge soft">Launch hardening</span>
                <span className="badge soft">975 path</span>
              </div>
              <p className="eyebrow">Curated cheap-flight trips</p>
              <h1>Cheap flights become easier to book when the trip already makes sense.</h1>
              <p className="lead">
                A creator-led travel-deal hub where Lindah turns special-priced fares into
                clear trip decisions: price, plan, risk note, content pack, alerts and a
                launch-ready publishing system.
              </p>
              <div className="metric-grid">
                <div className="metric">
                  <b>{productionReadiness()}</b>
                  <span>spec score</span>
                </div>
                <div className="metric">
                  <b>{potentialAfterDeploy()}</b>
                  <span>deploy potential</span>
                </div>
                <div className="metric">
                  <b>{deals.length}</b>
                  <span>sample deals</span>
                </div>
                <div className="metric">
                  <b>{heroAvgScore}</b>
                  <span>average score</span>
                </div>
              </div>
            </div>

            <div className="feature-card">
              <div className="photo-panel">
                <img src={selectedDeal.image} alt={`${selectedDeal.to} featured trip`} />
                <div className="overlay" />
                <div className="photo-content">
                  <div className="top-row">
                    <span className="badge soft">Featured find</span>
                    <button className="glass-pill" type="button" onClick={() => toggleSave(selectedDeal.slug)}>
                      {savedSlugs.includes(selectedDeal.slug) ? '♥ Saved' : '♡ Save'}
                    </button>
                  </div>
                  <div>
                    <p className="mini">{selectedDeal.from} to</p>
                    <h2>{selectedDeal.to}</h2>
                    <div className="badges">
                      <span className="price-pill">{money(selectedDeal.price)}</span>
                      <span className="orange-pill">{selectedDeal.durationDays}-day plan</span>
                      <span className="glass-pill">Risk {selectedDeal.risk}/100</span>
                    </div>
                    <p>{selectedDeal.lindahNote}</p>
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
              <p className="eyebrow-dark">Flight deals</p>
              <h2>A travel marketplace feel, but curated like Lindah</h2>
            </div>
            <div className="notice">Sample prices only. No live fares yet.</div>
          </div>
          <div className="search-grid">
            <label className="field">
              <span>Search</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Barcelona, sun, Manchester, food..."
              />
            </label>
            <label className="field">
              <span>From</span>
              <select value={airport} onChange={(event) => setAirport(event.target.value)}>
                {airports.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Trip type</span>
              <select value={tripType} onChange={(event) => setTripType(event.target.value)}>
                {tripTypes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Sort</span>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="price">Lowest price</option>
                <option value="score">Highest score</option>
                <option value="saving">Biggest saving</option>
                <option value="easy">Easiest trip</option>
                <option value="risk">Lowest risk</option>
                <option value="content">Best content potential</option>
              </select>
            </label>
            <button className="btn btn-blue" type="button" onClick={clearFilters}>
              Reset filters
            </button>
          </div>
        </section>

        {comparedDeals.length > 0 && (
          <section className="section compare">
            <div className="section-head">
              <div>
                <p className="eyebrow-dark">Compare mode</p>
                <h2>Shortlist comparison</h2>
              </div>
              <button className="btn btn-soft" type="button" onClick={() => setCompareSlugs([])}>
                Clear
              </button>
            </div>
            <div className="compare-grid">
              {comparedDeals.map((deal) => (
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

        <section className="section" id="deals">
          <div className="section-head">
            <div>
              <p className="eyebrow-dark">Deal board</p>
              <h2>Searchable and trustworthy, but still creator-led</h2>
            </div>
            <p>
              This mirrors the CGPT prototype direction: stronger polish, clearer trust notes,
              a shortlist flow and enough operational structure to move into real Next.js pages.
            </p>
          </div>
          <div className="deal-grid">
            {filteredDeals.map((deal) => (
              <article
                className={`deal-card${selectedDeal.slug === deal.slug ? ' active' : ''}${compareSlugs.includes(deal.slug) ? ' compared' : ''}`}
                key={deal.id}
              >
                <button className="deal-main" type="button" onClick={() => selectDeal(deal.slug)}>
                  <div className="card-img">
                    <img src={deal.image} alt={`${deal.to} preview`} />
                    <div className="overlay" />
                    <div className="chips">
                      <span className="badge navy">{deal.badge}</span>
                      <span className={`badge ${riskTone(deal.risk)}`}>Risk {deal.risk}</span>
                    </div>
                    <div className="price-row">
                      <div>
                        <div className="mini">{deal.from} to</div>
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
                      <div className="info">{deal.durationDays}-day plan included</div>
                      <div className="info">{deal.airport}</div>
                      <div className="info">{deal.type}</div>
                      <div className="info">{deal.freshness}</div>
                    </div>
                  </div>
                </button>
                <div className="card-actions">
                  <button className="btn btn-soft" type="button" onClick={() => toggleSave(deal.slug)}>
                    {savedSlugs.includes(deal.slug) ? '♥ Saved' : '♡ Save'}
                  </button>
                  <button className="btn btn-soft" type="button" onClick={() => toggleCompare(deal.slug)}>
                    {compareSlugs.includes(deal.slug) ? '✓ Compare' : '+ Compare'}
                  </button>
                  <button className="btn btn-blue" type="button" onClick={() => selectDeal(deal.slug)}>
                    View
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!filteredDeals.length && (
            <div className="panel white">
              <h2>No sample deals match that search.</h2>
              <p>Clear the filters and try again.</p>
            </div>
          )}
        </section>

        <section className="section split" id="trip">
          <div className="split-grid">
            <div className="split-photo">
              <img src={selectedDeal.image} alt={`${selectedDeal.to} selected trip`} />
              <div className="overlay" />
              <div className="photo-content">
                <div className="top-row">
                  <span className="badge soft">Selected trip</span>
                  <button className="glass-pill" type="button" onClick={() => toggleSave(selectedDeal.slug)}>
                    {savedSlugs.includes(selectedDeal.slug) ? '♥ Saved' : '♡ Save'}
                  </button>
                </div>
                <div>
                  <p className="mini">{selectedDeal.from} to</p>
                  <h2>{selectedDeal.to}</h2>
                  <p>{selectedDeal.lindahNote}</p>
                </div>
              </div>
            </div>
            <div className="split-content">
              <span className="badge orange">Decision engine</span>
              <h2>{selectedDeal.title}</h2>
              <p>{selectedDeal.summary}</p>
              <div className="score-grid">
                <div className="score"><b>{selectedDeal.score}</b><span>overall</span></div>
                <div className="score"><b>{selectedDeal.ease}</b><span>ease</span></div>
                <div className="score"><b>{selectedDeal.demand}</b><span>demand</span></div>
                <div className="score"><b>{selectedDeal.contentScore}</b><span>content</span></div>
                <div className="score"><b>{selectedDeal.risk}</b><span>risk</span></div>
              </div>
              <div className="two-col">
                <div className="panel">
                  <h2>What Lindah checked</h2>
                  {selectedDeal.checks.map((item) => (
                    <div className="check" key={item}>✓ {item}</div>
                  ))}
                </div>
                <div className="panel amber-panel">
                  <h2>Before you click</h2>
                  <p><strong>Warning:</strong> {selectedDeal.warning}</p>
                  <p><strong>Budget guide:</strong> {selectedDeal.budget}</p>
                  <p><strong>Luggage:</strong> {selectedDeal.luggageRisk}</p>
                  <p><strong>Hotel:</strong> {selectedDeal.hotelRisk}</p>
                  <p><strong>Transfer:</strong> {selectedDeal.transferEase}</p>
                  <div className="top-row pad-top">
                    <Link className="btn btn-orange" href={`/deals/${selectedDeal.slug}`}>Open full deal page</Link>
                    <Link className="btn btn-soft" href="/alerts">Join alerts</Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section studio" id="studio">
          <div className="itinerary-box">
            <p className="eyebrow-dark">Trip builder</p>
            <h2>{selectedDeal.durationDays} days in {selectedDeal.to}</h2>
            <div className="day-tabs">
              {selectedDeal.itinerary.map(([day], index) => (
                <button
                  className={`btn ${index === activeDay ? 'btn-blue' : 'btn-soft'}`}
                  key={day}
                  type="button"
                  onClick={() => setActiveDay(index)}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="check">
              <strong>{selectedDeal.itinerary[activeDay][0]}: {selectedDeal.itinerary[activeDay][1]}</strong>
              <br />
              {selectedDeal.itinerary[activeDay][2]}
            </div>
          </div>

          <div className="social-card">
            <img src={selectedDeal.image} alt={`${selectedDeal.to} social card`} />
            <div className="social-inner">
              <div>
                <span className="badge soft">Social studio</span>
                <h2>{selectedDeal.socialSlides[activeSlide]}</h2>
                <p>{selectedDeal.emailSubject}</p>
              </div>
              <div>
                <div className="check">{selectedDeal.caption}</div>
                <div className="top-row pad-top">
                  <button className="btn btn-soft" type="button" onClick={() => setActiveSlide((activeSlide - 1 + selectedDeal.socialSlides.length) % selectedDeal.socialSlides.length)}>Prev</button>
                  <button className="btn btn-white" type="button" onClick={() => setActiveSlide((activeSlide + 1) % selectedDeal.socialSlides.length)}>Next</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow-dark">Content pack</p>
              <h2>One deal, four reusable outputs</h2>
            </div>
            <p>
              This is the shift from a pretty prototype into something Lindah can actually use
              for SEO, email and social publishing.
            </p>
          </div>
          <div className="content-grid">
            <div className="panel">
              <h3>SEO title</h3>
              <p>{selectedDeal.title} from {money(selectedDeal.price)}, {selectedDeal.durationDays}-day itinerary</p>
            </div>
            <div className="panel">
              <h3>Caption</h3>
              <p>{selectedDeal.caption}</p>
            </div>
            <div className="panel">
              <h3>Email subject</h3>
              <p>{selectedDeal.emailSubject}</p>
            </div>
            <div className="panel">
              <h3>Route</h3>
              <p>/deals/{selectedDeal.slug}</p>
            </div>
          </div>
        </section>

        <section className="section launch-grid">
          <div className="panel white">
            <span className="badge green">Audience demand</span>
            <h2>Where should Lindah find deals next?</h2>
            {poll.map((item) => {
              const percent = Math.round((item.votes / totalVotes) * 100);
              return (
                <button className="compare-item" key={item.label} type="button" onClick={() => vote(item.label)}>
                  <div className="top-row">
                    <strong>{item.label}</strong>
                    <span>{percent}%</span>
                  </div>
                  <div className="bar"><div style={{ width: `${percent}%` }} /></div>
                </button>
              );
            })}
            {voted && <div className="notice">Vote added for {voted}.</div>}
          </div>

          <div className="panel white" id="alerts">
            <span className="badge blue">Owned audience</span>
            <h2>Deal alerts that bring people back</h2>
            <p>Social brings attention. Email alerts help Lindah build an owned audience.</p>
            <AlertsSignupForm compact source="home-alerts-panel" />
            {savedDeals.length > 0 && (
              <>
                <h3>Saved deals</h3>
                <div className="content-grid">
                  {savedDeals.map((deal) => (
                    <button className="panel" key={deal.slug} type="button" onClick={() => selectDeal(deal.slug)}>
                      <strong>{deal.title}</strong>
                      <p>{money(deal.price)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="section" id="trust">
          <div className="section-head">
            <div>
              <p className="eyebrow-dark">Trust centre</p>
              <h2>Safe enough to send, structured enough to build</h2>
            </div>
            <p>This is where the v7 pass moves the prototype closer to a serious launch package.</p>
          </div>
          <div className="content-grid">
            {trustItems.map(([title, body]) => (
              <div className="panel white" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <div>
              <p className="eyebrow-dark">SEO moat</p>
              <h2>Every deal becomes searchable travel content</h2>
            </div>
            <p>The deployable build now has the correct route map for deals, destinations, itineraries, blogs, alerts and legal pages.</p>
          </div>
          <div className="seo-grid">
            {seoPages.map((route) => (
              <div className="route-pill" key={route}>{route}</div>
            ))}
            <div className="route-pill">/sitemap.xml</div>
            <div className="route-pill">/robots.txt</div>
          </div>
        </section>

        <section className="section launch-grid" id="launch">
          <div className="panel white">
            <span className="badge green">Regression guard</span>
            <h2>Quality checks: {passedChecks}/{checks.length}</h2>
            {checks.map((check) => (
              <div className="check" key={check.name}>
                {check.pass ? '✓' : '!'} {check.name}
              </div>
            ))}
          </div>
          <div className="panel white">
            <span className="badge blue">Next.js file map</span>
            <h2>Ready for Vercel extraction</h2>
            <div className="seo-grid pad-top">
              {nextFiles.map((file) => (
                <div className="route-pill" key={file}>{file}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="section panel white">
          <span className="badge orange">Blog system</span>
          <h2>Editorial runway for search and trust</h2>
          <div className="content-grid pad-top">
            {blogIdeas.map((idea) => (
              <div className="panel" key={idea}>
                <h3>{idea}</h3>
                <p>Draft this as a practical, audience-first guide with internal links to relevant deals.</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="footer">
          {appConfig.name} • {appConfig.version} • Spec score {appConfig.currentSpecScore}/{appConfig.targetScore}
          <br />
          Sample fares only. Live audience launch still depends on real deal sourcing, email provider setup, legal review and deployment access.
        </footer>
      </main>
    </>
  );
}
