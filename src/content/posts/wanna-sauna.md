---
title: "Wanna Sauna?"
description: "For a few glorious years, I had a sauna in my living room. I recommend it!"
# Ported from jaan.li/wanna-sauna, an Observable Framework page. The date is the
# day the file was added there, not the day it was ported.
#
# EVERY BARE DOLLAR SIGN IN THE PROSE BELOW IS WRITTEN \$. This site parses
# single `$…$` as inline maths (see astro.config.mjs), and this piece is about
# what things cost: unescaped, "it cost $500 off eBay … upwards of $50 per
# visit" set the forty words between the two amounts as an equation. The same
# escape appears in the thesis post. It is NOT needed inside the <figure> below,
# which is a raw HTML block the Markdown parser does not look into, and not
# inside the ```mermaid fence, which is why the diagram — nothing but dollar
# signs — can be carried over from jaan.li byte for byte.
date: 2024-10-05
thumb: ../../assets/thumbs/hot-springs.svg
# A frame out of the timelapse below, rather than a second photograph: it is the
# only picture this piece has. THE FILE IS AN UPSCALE and it is meant to be. The
# animation is 480 x 270 — the highest resolution that exists — and the card
# [slug].astro cuts is 1200 x 630; Astro will not enlarge a source to fill a
# requested size, so pointing this at the raw frame emitted a 480 x 270 JPEG
# under <meta> tags promising 1200 x 630, which `npm run audit` fails on and
# which unfurls as a small card besides. So the frame was resized to 1200 x 675
# with sharp (lanczos, a touch of sharpening) before being committed, and the
# pipeline crops rather than enlarges. It is soft. It is a photograph of the
# thing the piece is about, which a share card is otherwise not going to be.
ogImage: ../../assets/og/wanna-sauna.png
ogImageAlt: "A finished light-wood sauna cabin standing against the wall of a
  living room, beside a sofa and a rug, with the front door of the apartment
  open behind it."
---

For a few glorious years, instead of paying the New York City tax of \$20 every time I set one foot out my door, I could have friends over and _sauna_ like the good Estonian I am. In my one bedroom apartment, unbeknownst to my landlord at the time, I managed to sneak in a disassembled sauna with a friend. It had cost \$500 on eBay, and the U-Haul moving truck cost \$100 to rent. 

Saunas are inaccessible; here's how to get one for your home, workplace, and city.

[saunalist.org has global sauna listings too!<span style="display: inline-block; margin-left: 0.25rem;">↗︎</span>](https://saunalist.org)

<figure>
  <img
    src="/images/wanna-sauna/wanna_sauna_assembling_a_500_dollar_sauna.webp"
    alt="A timelapse of two people assembling a wooden sauna in a living room, from flat panels leaning against the wall to a finished cabin beside the sofa."
    width="480"
    height="270"
    loading="lazy"
    decoding="async"
  />
  <figcaption>Assembling a $500 sauna, in about thirty seconds.</figcaption>
</figure>

Saunas have financial returns and non-financial returns. They also cost variable amounts of money.

In the above video, you can see my friend Jeff and I assembling the first sauna I bought. It sat 3 people, lasted for several years, hundreds of friends used it; it cost \$500 off eBay. Jeff and I had a wake-up call during the pandemic where we realized we had spent thousands of dollars at the Russian Turkish Bathhouse in New York, which can cost upwards of \$50 per visit. We decided to buy a sauna instead.

The non-financial returns have been immense, which is why I decided to document a framework for visualizing and thinking about the "capital stacks", or the stack of capital investments that can be made in saunas, from personal saunas to public saunas to workplace saunas to commercial (for-profit) saunas.

The non-financial returns of saunas include:

- social connection risk score reduction (c.f. reviews on the public health risks of [loneliness](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5598785/))
- health benefits, such as reduced all-cause mortality (c.f. many articles such as [this one](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6262976/) describing research in cultures in which saunas are common, such as Finland)

Edit the following diagram [here](https://www.mermaidchart.com/app/projects/3eff3399-79fc-46e3-a424-3e78655e6142/diagrams/2168f791-4b5b-4eec-9f86-ca194dee46b7/version/v0.1/edit) if you have any suggestions, or Tweet/DM me on Twitter at [@thejaan](https://x.com/thejaan)!

```mermaid
timeline
    section Personal Saunas
        $60 : Amazon Tiny Sauna Tent or Sauna Blanket
            : Est. IRR 0% (Personal use)
        $3,000 : HSA Infrared Sauna
            : Est. IRR 0% (Personal use)
        $5,000 : Barrel Sauna (Costco/eBay/Alibaba)
            : Est. IRR 0% (Personal use)
        $10,000 : 3D Printed Concrete Sauna
            : Est. IRR 0% (Personal use)
    section Public Saunas
        $500K : Raua Saun (Tallinn)
            : 8 EUR per visit
            : Est. IRR 5-8% (10-15 year horizon)
        $20M : Kultuurisauna (Finland)
            : Free public use
            : Est. IRR N/A (Public good)
    section Workplace/School Saunas
        $100K : Tartu University (Estonia)
            : Delta Center Faculty/Student Sauna (free benefit)
            : Est. IRR N/A (Employee/Student Benefit)
        $150K : Chalmers University (Sweden)
            : CS-bastun (CS-sauna)
            : Chalmers Kårhus Union Building Sauna
            : Est. IRR N/A (Employee/Student Benefit)
    section Commercial Saunas
        $8M : Othership (NYC)
            : $50-80 per 90min session
            : Est. IRR 15-20% (5-7 year horizon)
        $30M : World Spa (Brooklyn)
            : $70-120 day pass
            : Est. IRR 12-15% (7-10 year horizon)
        $40M : Bathhouse (NYC)
            : $80-100 per visit
            : Est. IRR 10-13% (8-12 year horizon)
        $50M : Aire Baths
            : $200-300 per visit
            : Est. IRR 15-18% (6-8 year horizon)
        $200M : Therme Group Project
            : $50-100+ per visit
            : Est. IRR 8-12% (10-15 year horizon)
```
