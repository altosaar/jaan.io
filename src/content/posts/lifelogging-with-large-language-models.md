---
title: "Lifelogging with Large Language Models"
# PLACEHOLDER — the schema rejects an empty description, so this holds the slot.
description: "Using large language models to make sense of a lifelog."
# SCAFFOLD: the body below is copied verbatim from the-gab-lab.md as a starting
# point (chiefly for its references sections). Cut what doesn't belong.
# The microlite mark, trimmed to its ink. See the file's own note.
thumb: ../../assets/thumbs/microlite.svg
date: 2026-09-12
---

AI has...

> [!cite]
> Zak, P. J. (2015). [Why inspiring stories make us react: The neuroscience of narrative](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4445577/). In *Cerebrum: the Dana forum on brain science*.

# Snapshots of note edits
Snapshots taken roughly a week apart of Hamlet's journal; Claude generated journals from Hamlet's perspective, roughly corresponding to acts I through IV of the play, as if it had taken place in present day.

<figure>
<iframe class="wide" title="Waffle chart of four weeks of edits to a synthetic journal, one square per edit" src="/files/lifelogging/microlite-waffle.html" height="900" loading="lazy"></iframe>
</figure>

# Patterns across snapshots
A language model read the fourth week and wrote a letter back. Each arrow is one sentence of that letter, joining the two edits it was written from. Click an arrow.

<figure>
<iframe class="wide" title="Waffle chart of the same edits coloured by topic, with arrows for the connections the letter drew between them" src="/files/lifelogging/connections-topics.html" height="1100" loading="lazy"></iframe>
</figure>

# Do it yourself

The easiest way I've found to do this is to use [Obsidian](https://obsidian.md/) to take personal and work notes. By looking at successive differences in the 'file recovery' feature built into Obsidian, it is possible to create snapshots of how every note has changed over a given time period. 

With the help of Claude I created the [Microlite Obsidian plugin](https://community.obsidian.md/plugins/microlite) to enable creating these snapshots automatically. 

To connect my bank accounts, investments, and credit card I used the [plaid-sync](https://github.com/mbafford/plaid-sync/) tool that leverages the [Plaid API](https://plaid.com/) to extract data from financial institutions into a [plain text format](https://sgoel.dev/posts/10-years-of-personal-finances-in-plain-text-files/) called Beancount.

To orchestrate all of this, with Claude and my friend David's input, we built [Petrograph](https://github.com/altosaar/petrograph). This takes the above sources as input (Microlite for snapshots of changes in notes, plain text finances data, and physiology data from Oura), and prompts Claude with something like the following:

> As an expert in Acceptance and Commitment Therapy and psychometric profiling from a clinical-psychology lens, provide stances to practice for the upcoming week. Keep it irreverent where appropriate, and circumscribe what to hold loosely, how to approach what is on my mind, and logistics or operations in the upcoming days such as summarizing any open loops. I'm open to any psychoemotional reads, metaphors or challenges you may have as an expert in these areas.

Then the [Eleven Labs](https://elevenlabs.io/) voice AI is used to convert the text to speech, and some audio plugins are used to add some effects like reverb and compression and mix it with a background audio track of the user's choice. This is the final output you can hear snippets of above.

Wary about sharing all of this personal data with Anthropic or OpenAI or using closed-source APIs like Eleven Labs'? I am too! Thankfully, when my friend David's partner was interested in trying this system out but didn't want to share their data, he whipped up a completely open source toolkit that spins up Amazon Web Services instances that ensure no private data ever gets shared with external services. You can find that here: https://github.com/dlakata/sublimation (we have tested its integration with the above tools).

# Summary

In the middle of several weeks, I have at times feared Claude's admonishment, fretting about what it would chide be about next - whether my actions were aligning with my stated values. I worried whether I was becoming an agent taking atomic actions in a hierarchical world model of my own construction, sitting in Plato's tokenized cave.



## Acknowledgments

Thank you to Toby for helping connect this practice to [lifelogging](https://en.wikipedia.org/wiki/Lifelog); to David, Sophie, Elana for thought partnership; to Frankie for calling this "Claudio journaling", and to additional friends who tolerated my sending of AI slop and cursed visualizations over the course of these experiments. 

# References
> [!cite]+
> The [Story-Telling Animal: How Stories Make us Human](https://www.amazon.com/Storytelling-Animal-Stories-Make-Human/dp/B08XLJ8XC9) is a book about our make-believe nature, traversing storytelling's evolution as a fundamental human instinct
> 
> [Pixar's \[Abridged\] Rules for storytelling](https://www.aerogrammestudio.com/2013/03/07/pixars-22-rules-of-storytelling/)
> 
> A library on all-things empathy, which may inspire you to practice it in different ways: [https://empathylibrary.com/](https://empathylibrary.com/)
> 
> [Empathy: Why It Matters and How to Get it](https://www.amazon.com/Empathy-Why-Matters-How-Get/dp/0399171401) is a book covering the science of empathy and arguing for empathy for a happier, more creative society. [🏴‍☠️ PDF](https://libgen.li/index.php?req=Empathy%3A+Why+It+Matters+and+How+to+Get+it)
>
> https://jordancooper.blog/2024/10/11/lifelogging-in-the-age-of-ai/
