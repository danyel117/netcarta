# NETCARTA

> _"Encyclopedia. Online. At last."_

Hackathon spec — **WLHNIHTBLTAH @ Frontier Tech Week**, Wynwood, Miami, April 22, 2026.
6-hour event, 5 hours of build time budgeted.

---

## 1. The Pitch

A lost Microsoft product from 2001: **Netcarta**, the online multiplayer successor to Encarta. Skeuomorphic CD-ROM encyclopedia chrome over live Wikipedia content, with a realtime head-to-head racing mode where players navigate from one article to another using only "See Also" links.

The joke is the fiction: it looks and feels like a boxed product that existed, and the modern tech (AI, realtime sync, Mux video) is hidden inside a 2001-shaped UI. That's the WLHNIHTBLTAH thesis in one product.

**Headline feature:** real-time multiplayer Wikiracing inside an Encarta-skinned app.

---

## 2. Core Mechanics

### Article View

Encarta-styled article page. Left: chunky sidebar with section nav. Center: summary, images, "Did You Know?" callout. Right: "See Also" links (clickable = navigation). Top: chunky Win9x title bar with minimize / maximize / close decorations.

Content source: **Wikipedia REST API v1** (summary, related, images). No LLM required for article content; cache responses in Convex by slug.

### Race Mode ("Netcarta Race")

1. Host creates a room, picks Start and End articles (or hits "Random Pair").
2. Shareable URL; judges / teammates / strangers can join.
3. On start, all players land on the Start article simultaneously.
4. Players navigate only via "See Also" links.
5. First to reach the End article wins. Tracks: click count, elapsed time, full path.
6. Post-race screen shows all paths side-by-side with "The Scenic Route" label on the loser.
7. Leaderboard stores race history (start pair, winner, time, clicks).

### Presence

Small Encarta-era user chips in the top-right show who's in the room and what article they're currently reading. Updates live via Convex subscriptions.

---

## 3. Tech Stack

| Layer            | Choice                      | Why                                                     |
| ---------------- | --------------------------- | ------------------------------------------------------- |
| Frontend         | React + Vite                | Known quantity, ship fast                               |
| Styling          | Tailwind + custom Win9x CSS | Skeuomorphism needs custom CSS; Tailwind handles layout |
| Backend          | Convex                      | Realtime sync is the whole product                      |
| Content          | Wikipedia REST API          | Free, no auth, CORS-enabled, real link graph            |
| AI (optional)    | Anthropic Haiku             | Post-race recap narration script, if time               |
| Video (optional) | Mux                         | AI-narrated post-race recap, if time                    |
| Hosting          | Cloudflare Pages + Workers  | Podium sponsor                                          |

---

## 4. Prize Targeting

Primary targets, in order of realism:

1. **Best Realtime Sync (Convex Ferrari)** — the race mechanic _is_ realtime sync. Strongest case on the field.
2. **Cloudflare podium** — hosted on Pages + Workers, uses Durable Objects for room routing if time permits.
3. **Best Use of Mux + AI (jacket)** — post-race AI-narrated recap video. Only attempted if core product works first.
4. **Neon credits** — persistent leaderboard storage (can split data between Convex for realtime and Neon for history).

Not targeting: Jazz Tools (would require replacing Convex; not worth the swap).

---

## 5. Scope

### MVP (non-negotiable)

- Encarta splash screen + home hub
- Article view with Wikipedia fetch
- "See Also" navigation
- Convex race rooms: join by URL, shared article state, live click/timer, win detection
- Pre-race screen: pick or randomize start/end
- Post-race screen: both paths side-by-side, winner callout
- Persistent leaderboard (top 10)

### Stretch (only if MVP is done by hour 3:45)

- One post-race Mux video with AI narration
- Presence cursors / user chips
- Daily challenge pair

### Explicitly cut

- Haiku article rewriting (use Wikipedia raw)
- Atlas / Timeline / MindMaze sections
- AI-generated article media
- Spectator mode
- Hints system

---

## 6. Five-Hour Build Plan

| Time        | Milestone                                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 – 0:45 | Scaffold NextJS + Convex. Splash screen. Home hub with chunky Win9x buttons.                                                     |
| 0:45 – 1:30 | Article view: Wikipedia summary + related + images, rendered in Encarta chrome. See Also links clickable.                        |
| 1:30 – 3:00 | Convex race rooms: schema, room creation, join flow, shared current article, click counter, timer, win detection, path tracking. |
| 3:00 – 3:45 | Pre-race screen (pick start/end). Post-race screen (paths + winner). Leaderboard table.                                          |
| 3:45 – 4:30 | Mux recap video (time-boxed, abort at 20 min). If skipped: polish presence chips instead.                                        |
| 4:30 – 5:00 | Splash audio, polish pass, write demo script, rehearse twice.                                                                    |

**Hard freeze at 4:00** — no new features after this. Only polish and rehearsal.

---

## 7. Demo Script (3 minutes)

1. **Splash (5s)** — orchestral sting, Netcarta logo, "Online Edition."
2. **Home hub (5s)** — four chunky buttons: Articles, Race, Atlas (greyed out), MindMaze (greyed out). Click Race.
3. **Challenge intro (15s)** — "Today's race: Cursor_(code_editor) → Artemis II." Show join URL + QR on screen. Invite judges to join from phones.
4. **Live race (60s)** — two players on stage, judges spectating. Clicks + timer update live for everyone. Winner arrives first.
5. **Post-race screen (20s)** — both paths side-by-side, "The Scenic Route" callout on the loser's path. Reveal time and click count.
6. **(Optional) Mux recap (15s)** — AI-narrated video of the winning path. Skip cleanly if not built.
7. **Leaderboard (10s)** — show the new entry. Mic drop.

---

## 8. Data Model (Convex)

```ts
// rooms
{
  _id, code, hostUserId,
  startArticle: string,  // wiki slug
  endArticle: string,
  status: "lobby" | "racing" | "finished",
  startedAt?: number,
  finishedAt?: number,
  winnerId?: string,
}

// participants
{
  _id, roomId, userId, displayName,
  currentArticle: string,
  path: string[],        // [slug, slug, slug]
  clickCount: number,
  finished: boolean,
  finishedAt?: number,
}

// articles (cache)
{
  _id, slug, title,
  summary: string,
  thumbnail?: string,
  seeAlso: { slug: string, title: string }[],
  fetchedAt: number,
}

// leaderboard
{
  _id, roomId, winnerName,
  startArticle, endArticle,
  clicks, timeMs,
  createdAt: number,
}
```

---

## 9. Visual Design Notes

- **Color:** Win9x teal desktop (`#008080`) as app background. Article chrome in 3D-beveled greys (`#c0c0c0`, `#808080` for shadows, `#ffffff` for highlights).
- **Typography:** Tahoma or MS Sans Serif for UI. Times New Roman for article body text.
- **Buttons:** Every button gets 2px outset borders to fake the beveled look. Active state uses inset.
- **Icons:** Chunky 32x32 pixel icons. Use [win98.io](https://jdan.github.io/98.css/) or similar CSS library as a base — skip writing it from scratch.
- **Splash:** 3-second fade-in Netcarta logo, orchestral sting (single mp3 asset). Skip button in the corner.

Recommended library: **98.css** or **XP.css** from jdan on GitHub. Near-zero effort, authentic chrome.

---

## 10. Risks & Mitigations

| Risk                                | Mitigation                                                       |
| ----------------------------------- | ---------------------------------------------------------------- |
| Wikipedia CORS fails from browser   | Proxy through a Convex action                                    |
| Convex realtime lag on stage        | Test with 3+ clients on real wifi before demo                    |
| Mux pipeline eats 2 hours           | Hard-timebox to 45 min, abort cleanly, UI still works without it |
| Someone closes the browser mid-race | Mark them as DNF, race continues                                 |
| Judges don't join the live demo     | Pre-arrange one teammate on laptop as backup player              |
| Wikipedia article has no images     | Fallback to Wikimedia Commons placeholder                        |

---

## 11. What Makes This Win

1. **The concept reads in 5 seconds.** "It's Encarta, but it's online and you race people through Wikipedia."
2. **The demo is inherently dramatic.** Two people racing on stage beats any feature tour.
3. **The realtime sync isn't decorative — it's the product.** Convex judges will feel it.
4. **The theme is nailed.** Skeuomorphism + chunky buttons + splash sting = instant nostalgia for anyone over 30.
5. **It's shareable after the event.** "I got Cursor_(code_editor) → Artemis II in 6 clicks" is a tweet.

---

_Ship the race. Polish the chrome. Skip anything that doesn't serve those two._
