# GBG Dubuque blog pipeline

Drafts only. Nothing in this folder is published (underscore folders are skipped by GitHub Pages).
A scheduled task writes one draft per run from queue.json. Ricky reviews drafts, then a blog
template is added to build.py when we are ready to publish.

## Draft rules
- 700 to 900 words. Plain, tight, local. Written for a Dubuque homeowner.
- Voice: conversational and direct. No filler. No AI sounding phrasing. No dashes as punctuation.
  Avoid the words "genuinely", "honestly", "straightforward", "elevate", "seamless", "game changer".
- GBG has not launched. Do NOT invent: reviews, job counts, years in business, prices, licenses,
  insurance claims, customer stories, statistics, or weather facts. Educational and honest only.
- Mention Dubuque and the tri-state area naturally. Service area is about 30 miles (IA, IL, WI).
- End with a soft call to action: book a private estimate. Link to the matching service page path
  (for example /permanent-lights/ or /driveway-sealing/).
- Include 3 FAQ questions at the bottom with short answers.

## Draft file format
Save as drafts/YYYY-MM-DD-<slug>.md starting with this block:

    ---
    title: <60 characters or fewer>
    slug: <kebab-case>
    meta_description: <150 characters or fewer>
    service_page: </permanent-lights/ or similar>
    target_keyword: <one phrase>
    ---

Then the body in markdown, with one H1 omitted (title is the H1), H2s for sections, and an
"FAQ" section at the end.

## Queue
queue.json holds topics. Status values: todo, drafted, published. Each run takes the first
todo, writes the draft, and sets status to drafted with the draft filename and date.
