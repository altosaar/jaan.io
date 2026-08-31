---
title: "Once Upon"
description: "How to use active listening and stories to facilitate communication and behavior change."
# PORTED VERBATIM from the Google Doc "once upon - edit" (One Fact Foundation),
# via its HTML export — text from the Markdown export, pictures from the HTML
# one, which is the only place the full-resolution originals survive.
#
# WHAT WAS CHANGED IN THE PORT, and nothing else:
#   - Google Docs' backslash escapes (\!, \-, \.) removed.
#   - The three "1. ### Support Autonomy" constructions — a heading nested
#     inside a numbered list, which is not a thing Markdown can express — became
#     "### 1. Support Autonomy".
#   - The in-document anchor to "Put yourself first" lost its colon, which is
#     what github-slugger does to it and therefore what the id on the page is.
#   - Two empty headings ("## " and "#### ") dropped.
#   - Two typos in the source repaired: a missing open parenthesis on the Arabic
#     for "consent", and a link whose closing bracket landed one character early
#     ("A language of lif](…)e").
#   - The four pictures moved from Google's floating anchors to the paragraph
#     each one illustrates, and gained alt text, which the export had none of.
#   - The fork in the road is NO LONGER THE DOC'S PICTURE. It was a 1600x1164
#     WebP of the drawing on its own white page, which on this site is a lit
#     slab in the middle of a black one; it is now the same drawing redrawn as
#     vector (Dropbox/design/260829-once-upon/SVG/fork-in-the-road-people.svg,
#     copied in unmodified — svgo finds 1% in it, which is not worth a step in
#     the pipeline). Black paths on nothing, so it takes `class="ink"` like the
#     line art in the older posts and the palette flips it to white: the
#     figures draw in white line and the road reads as a lit road rather than
#     as a hole. See the .ink note in Prose.astro. It is also 32KB against 48,
#     and it is now resolution-independent, which for a line drawing on a
#     retina screen is the whole point.
#   - The two bare YouTube links in the body — Bowie on MTV, and the Brandon
#     Stanton talk — are now the videos themselves, as `<lite-youtube>` facades
#     rather than <iframe>s. See src/components/YouTubeRuntime.astro for what
#     that is and what it saves. Each poster frame is this origin's own file
#     (the video's maxresdefault.jpg as WebP, 34KB and 19KB), so nothing is
#     requested from Google until the play button is pressed, and each link the
#     doc had survives as that button's href: with no script, the figure is the
#     still with a link to YouTube over it. The doc's "(21:19)" on the Stanton
#     link was a cue to skip ahead, so it is `params="start=1279"` on the
#     element and `&t=1279s` on the href — the player and the fallback link
#     both open where the doc pointed — and the caption still says so in words.
#   - EVERY HEADING PROMOTED ONE LEVEL, and nothing else about them: the text
#     is untouched, so every slug — and the two in-document links above, which
#     point at slugs — is the same. The doc opened with one `#` and then set
#     its remaining five sections in `##`, which left the piece with a single
#     top-level heading. The contents rail lists a post's shallowest heading
#     level (src/components/Toc.astro) and suppresses a list of one, so the
#     rail disappeared from this post entirely. Promoted, the six sections are
#     six `#`s and the rail lists them; sub-sections that were `###` are `##`
#     and stay out of it. Body `#`s are styled as section headings rather than
#     at title size — see `h1:not(.post-title)` in Prose.astro.
#
# STILL TO DECIDE BEFORE THIS SHIPS (see the branch it lives on):
#   - The "[visual: story spine …]" note and the "Owner:" line at the top are
#     production scaffolding from the doc, not prose. Kept so nothing is lost in
#     the port; almost certainly to be cut.
#   - The "It's not your fault" animation is a clip from Good Will Hunting.
#
# The mark on /writing, and the art on the share card a link to this previews
# as — a detail of the article's own third figure. See the file's own note.
thumb: ../../assets/thumbs/fork-in-the-road.svg
# The doc's own stated release date, not the day it was ported.
date: 2023-08-01
# CARRIES A TIME, and that is the point. This is the field that becomes
# <updated> in the Atom feed, and it is the only signal a subscriber's reader
# has that a piece it already holds has changed. A bare `2026-08-31` is midnight
# UTC, which is the exact string the feed had already served earlier today —
# a second revision on the same day would have been invisible to every reader.
# The time makes the stamp distinct. Nothing on the page shows it: [slug].astro
# formats this as month and year.
updated: 2026-08-31T13:20:00Z
---

Say you're helping someone tell their story of how they might change their life for the better. A story that shows where they are now, and where they want to go.

As a listener, you can help someone discover meaning by demonstrating understanding and supporting the evolution of the stories that matter to them. Such stories, in turn, shape their behavior.

Connecting communication with behavior requires using narrative: learning what motivates someone can using help shift their story and incite change. At each stage of this process, giving them space to be the main character of their story requires awareness of which roles you might play in support.

> [!cite]
> Zak, P. J. (2015). [Why inspiring stories make us react: The neuroscience of narrative](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4445577/). In *Cerebrum: the Dana forum on brain science*.

<!--**Change is hard for all of us.**-->

*Once Upon* is a communication and behavior change tool to empower yourself—and, perhaps, someone around you—to take actions aligned with values and make meaningful change.

This requires combining tried-and-tested interpersonal skills such as active listening and motivational interviewing with the power of storytelling to enable caring and productive dialogue.

Good news: you already experience the core skills needed for this. Every time you support your own or someone else's freedom to make choices, express empathy, ask open-ended questions, or help make sense of messiness, you use these muscles.

The bad news: this can be challenging! 

It can feel awkward, overwhelming, and mechanical to notice and shift the ways in which we communicate. We might suck at first; at least I felt that way and often do. And, to be transparent with someone else about your practice is vulnerable.

When interacting with people we care about, we might take on habitual roles, and becoming aware of such patterns of behavior takes practice, curious and intention. Similarly, learning to be attentive to our own emotions in addition to someone else's can be intense – especially when giving someone space to lead a conversation when things get emotional.

## Transparency

As an interpersonal tool, these skills are collaborative: if only one person holds the keys to a tool or bestows its use, it doesn't count. The intention in using these methods is to help foster the growth and well-being of the person being listened to, not for another purpose that benefits the listener or manipulates.

Use it *for* another person, not *on* another person. (All it can take is a simple "Hey, I learned about this approach to conversation—mind if we try it? Let me know if you don't feel like continuing at any point.")

Proceed with caution. This material is designed to be used with care and responsibility.

## Foundations

Once Upon draws on the science of behavior change and motivation. Specifically, it's built on a clinical approach to enhancing motivation, called motivational interviewing, and a theory of motivation called self-determination theory. Motivational interviewing has been shown to be effective in eliciting behavior change in various settings, from hostage negotiation to chaplaincy work and smoking cessation, while self-determination theory is backed by 40 years of psychological studies on the driving forces behind human behavior across domains, from finance to health.

> [!cite]
> On the compatibility of motivational interviewing and self-determination theory:
>
> Vansteenkiste, M., & Sheldon, K. M. (2006). [There's nothing more practical than a good theory: Integrating motivational interviewing and self‐determination theory](https://citeseerx.ist.psu.edu/document?repid=rep1&type=pdf&doi=7d9b461eec6d04a7a4b35a7ed75a2e80609f6dd1). *British journal of clinical psychology*, *45*(1), 63-82.
>
> Support for self-determination theory in the workplace:
>
> Gagné, M., & Deci, E. L. (2005). [Self‐determination theory and work motivation](https://doi.org/10.1002/job.322). *Journal of Organizational behavior*, *26*(4), 331-362. [🏴‍☠️ PDF](https://sci-hub.st/10.1002/job.322)
>
> Support for self-determination theory in sports coaching:
>
> Mageau, G. A., & Vallerand, R. J. (2003). [The coach–athlete relationship: A motivational model](https://doi.org/10.1080/0264041031000140374). Journal of Sports Sciences, 21(11), 883–904. doi:10.1080/0264041031000140374. [🏴‍☠️ PDF](https://sci-hub.st/10.1080/0264041031000140374)
>
> On the effectiveness of Motivational Interviewing:
>
> Lundahl, B., & Burke, B. L. (2009). [The effectiveness and applicability of motivational interviewing: A practice‐friendly review of four meta‐analyses](https://doi.org/10.1002/jclp.20638). *Journal of clinical psychology*, *65*(11), 1232-1245. [🏴‍☠️ PDF](https://sci-hub.st/10.1002/jclp.20638)

# Guiding Principles

We identify three commitments to guide this practice: support autonomy, express empathy, and make sense of messiness. These principles—rooted in self-determination theory and motivational interviewing—serve as a foundation from which to develop the skills essential to enable communication and behavior change.

## 1. Support Autonomy

Autonomy is the ability to be the main character of one's own life and to make decisions freely based on what one cares about.

Supporting autonomy means allowing the other person to take the lead, trusting their expertise in designing an ending that serves them best, and helping them discover their *own* reasons and solutions. If their hands are on the steering wheel, they're deciding where to go, with you being in the passenger seat seeing how you might help orient.

The result of experiencing autonomy is psychological empowerment: when a person believes they have control over their lives, they can successfully make changes and envision different possibilities for themselves. In other words, supporting autonomy creates possibilities for change. Extensive research on autonomy-supportive communication backs this as key to behavior change. When people are autonomous, behavior change is more effective and lasting. But supporting autonomy isn't just stepping back and acting as a sounding board. You'll need to listen and empathize too.

## 2. Express Empathy

> As the ER doors swung open, the nurse was immediately hit with a wave of chaos. The smell of antiseptic mixed with the sounds of moaning patients and pacing family members, all vying for her attention.
>
> It was a typical day in the ER, with life and death hanging in the balance. But the nurse had a secret weapon—empathy.
>
> She assessed each patient's condition, listening carefully to their complaints, taking note of the urgency of their symptoms, and assigned each a priority level.

The goal is to get the story right, not to _be right_. It's not you versus them, it's both of you versus the topic, or both of you versus a misunderstanding; you're on the same team. Empathy can help with this. Defined as both understanding and being able to show you understand, empathy unlocks possibilities for change.

In the case of the triage nurse, her empathy allowed her to get the patients' stories right, which in turn led to informed decisions about how and when to assign time and energy to help each of them. In the same way, a parent's empathy gives them extraordinary ability to understand the degree of distress of their infant and to respond accordingly. Empathy isn't just used for specific situations, though. You can empathize with people in your everyday life. Feeling heard and understood endows a sense of psychological empowerment that is foundational for positive change.

Practicing empathy starts with an intention to listen, completely and attentively, the practice of which is described below.

> [!cite]
> On Empathy in therapeutic change:
>
> Rogers, C. R. (1957). [The necessary and sufficient conditions of therapeutic personality change](https://psycnet.apa.org/doi/10.1037/0022-006X.60.6.827). *Journal of consulting psychology*, *21*(2), 95. [🏴‍☠️ PDF](https://sci-hub.st/https://psycnet.apa.org/doi/10.1037/0022-006X.60.6.827)
>
> Empathy as a key ingredient in motivational interviewing:
>
> Lundahl, B., & Burke, B. L. (2009). [The effectiveness and applicability of motivational interviewing: A practice‐friendly review of four meta‐analyses](https://doi.org/10.1002/jclp.20638). *Journal of clinical psychology*, *65*(11), 1232-1245. [🏴‍☠️ PDF](https://sci-hub.st/10.1002/jclp.20638)

## 3. Make Sense of Messiness

Humans are driven to move towards our aspirations and act on hunches about what would bring us survival, joy, or fulfillment, whether it be as simple as getting a soda at the nearby store, or aiming to become a better friend, partner, or parent. Yet we often face obstacles that prevent us from achieving our goals, one of which is ambivalence: the uncertainty or indecision stemming from a simultaneous experience of conflicting feelings. Ambivalence can be a considerable problem, to the point that it can lead us to abandon a goal altogether.

<figure>
  <img
    class="ink"
    src="/images/once-upon/fork-in-the-road.svg"
    alt="A line drawing of a road forking in two. One person sits beside it scratching their head over an open book; a signpost points both ways with blank signs; another person runs off to the right."
    width="1270"
    height="1135"
    loading="lazy"
    decoding="async"
    style="max-width: 60%"
  />
</figure>

This is where making sense of messiness shines. Identifying meaning in a complex situation serves to help individuals identify goals, overcome obstacles, and move forward with greater purpose and alignment. Not surprisingly, sense-making has been shown as key in healing from life's tragedies. Those who tell their story, make sense of past tragedies, and see the benefit of them tend to cope better, close chapters, and write new ones.

As a listener, you can make this happen by providing a space in which another person can organize narratives, articulate their thoughts, and seek help in navigating obstacles to taking an initial step in a direction they desire.

> [!cite]
> On sense-making:
>
> Wilson, T. D., & Gilbert, D. T. (2005). [Affective forecasting: Knowing what to want](https://psycnet.apa.org/doi/10.1111/j.0963-7214.2005.00355.x). *Current directions in psychological science*, *14*(3), 131-134. [🏴‍☠️ PDF](https://sci-hub.st/https://psycnet.apa.org/doi/10.1111/j.0963-7214.2005.00355.x)
>
> Pennebaker, J. W. (1997). [Opening up: The healing power of expressing emotions](https://archive.org/details/openinguphealing00penn/page/n13/mode/2up). Guilford Press.
> 
> The neuroscience of mirror neurons and how they are used in ethnography, for understanding different cultures:
>
> [https://drive.google.com/file/d/1aGpfAcJASHaZJVvk8Yb5oqenbjroHnO7/view?usp=sharing](https://drive.google.com/file/d/1aGpfAcJASHaZJVvk8Yb5oqenbjroHnO7/view?usp=sharing)
> Summers-Effler, E., Van Ness, J., & Hausmann, C. (2015). [Peeking in the Black Box: Studying, Theorizing, and Representing the Micro-Foundations of Day-to-Day Interactions: Studying, Theorizing, and Representing the Micro-Foundations of Day-to-Day Interactions](https://doi.org/10.1177/0891241614545880). Journal of Contemporary Ethnography, 44(4), 450-479. [🏴‍☠️ PDF](https://sci-hub.st/10.1177/0891241614545880)

# Core Skills


> Ornette Coleman broke the rules of jazz, and made a name for himself as the developer of 'free jazz'. Ornette's free jazz was all about listening to the collective others, not simply call-and-response, but evolving the musical work as a unit in real time. 
—John Z Sadler, [Psychiatry at the Margins](https://www.psychiatrymargins.com/i/111711086/person-ornette-coleman)

Coleman was attuned, empathic, and responsive to his fellow musicians. That attunement to interactivity is a profound constraint and opens up possibilities. 

## Give space by listening
Using the skills in Once Upon starts with an intentional decision to give up autonomy and give space to the other person by listening. Taking this stance is like free jazz; we constrain ourselves momentarily to allow for possibilities.

This constraint can look like silence—even just a few seconds—to give our listening partner autonomy in the conversation.

Things we have found helpful in pursuit of this practice include:
* Saying minimal words of encouragement like "right," "ok," and "mm" in affirmation.
* Counting the number of words we say.
* Saying nothing at all, and listening with body language.
* Undivided attention, usually with eye contact or an open posture
* Leaning, nodding, and mirroring facial expressions and body language.

Noticing the non-verbal behaviors of someone we are talking to can help us understand the qualities of the conversation. These can be subtle or overt, and unless we are neurodivergent we can tune into our innate ability to notice non-verbals with a bit of practice.

In this video, Bowie holds eye contact, laughs, smiles, and nods his head up and down, yet… his eye contact is nearly frozen, his facial muscles are tense, his smile constrained, he blushes while laughing, and his response is minimal ("Interesting"). 

<figure>
  <lite-youtube
    videoid="XZGiVzIr8Qg"
    title="David Bowie Criticizes MTV for Not Playing Videos by Black Artists | MTV News"
    data-title="David Bowie Criticizes MTV for Not Playing Videos by Black Artists | MTV News"
    style="background-image: url('/images/once-upon/bowie-mtv-poster.webp')"
  >
    <a class="lyt-playbtn" href="https://www.youtube.com/watch?v=XZGiVzIr8Qg">
      <span class="lyt-visually-hidden"
        >Play: David Bowie asks MTV why it does not play videos by Black artists</span
      >
    </a>
  </lite-youtube>
</figure>

Non-verbal communication patterns vary across cultures, and we address this in the [Resources section](#consider-how-culture-shapes-stories). We also note that being an attentive listener is essential for personal growth, yet hard to perfect. It requires mindfulness to engage with the other. See "[Prioritize your needs](#prioritize-your-needs-empower-yourself-to-empower-someone-else)".

## Storyboard: notice and develop arcs in stories

These tools help another person develop their story, guiding its flow and development:

**A**sk open-ended questions

**A**dvise/inform

**R**eflective listening

**C**onvey affirmations

**S**ummarize.

We know these all instinctively, you might say! In a story, one seemingly insignificant, tiny shift can have a ripple effect, spurring character development and advancement of the protagonist towards desired trajectory.

The same goes for communication. One tiny shift in how we communicate has the potential to spur personal development and transform a trajectory. Let's go over each component of this core skill and discuss how it informs active listening and helping someone develop their narrative arcs.

### Ask 

Open-ended questions are questions that open up different pathways of discussions and can help uncover new insights and perspectives. This type of question contrasts with close-ended questions, which elicit specific information that can usually be offered with a short answer ("yes" or "no").

Open-ended questions can be used to:

- Reflect on reasons for change: "What is the change you'd like to make?"
- To spur excitement about change: "What would be the best thing about making this change?"
- To make sense of messiness: "You're telling me you wish things were different, but for now you'll keep things how they are. What's going on with that?"
- To make desired endings a reality, "How do you know that you'd be able to do it if you tried?"

In Humans of New York, Brandon Stanton (a street photographer) uses open-ended questions to collect compelling stories of New Yorkers.

<figure>
  <lite-youtube
    videoid="2IGep_7OOgQ"
    params="start=1279"
    title="Tell a Different Story: Brandon Stanton"
    data-title="Tell a Different Story: Brandon Stanton"
    style="background-image: url('/images/once-upon/humans-of-new-york-poster.webp')"
  >
    <a class="lyt-playbtn" href="https://www.youtube.com/watch?v=2IGep_7OOgQ&t=1279s">
      <span class="lyt-visually-hidden"
        >Play from 21:19: Brandon Stanton on the questions he asks strangers</span
      >
    </a>
  </lite-youtube>
  <figcaption>Starts at 21:19.</figcaption>
</figure>

Close-ended questions have their place too. They may be helpful in supporting the development of one's narrative until the end (committing to a change). Examples of such questions include, "When do you plan on taking up [taking the first step toward a new habit]?"

Questions are helpful, yet tend to be overused. If you sense the someone may feel bombarded with all the questions, try changing a question to a reflection by removing the upward inflection at the end.

### Advise

Advising involves sharing information to help develop a narrative. In the case of a person aiming to take better care of their health, this might mean identifying resources ("there's a help center nearby that offers free consults" or sharing knowledge ("this hospital has a cheaper option for the treatment you're looking for").

Advising can be done in an empathic, autonomy-supportive way. Listen to understand which facts, resources, or insights might be relevant to the person's story. Consider asking for permission to ensure the person is open to receiving the information. You might say, for example: "Mind if I share something that helped me with this? Feel free to discard it if it's not helpful to you". Following up to for their response to new information or confirming their understanding of can help support autonomy.

Avoid imposing acceptance of any information or solutions you provide. Instead, focus on accepting where the person is in their journey and empowering them to make their own choices.

### Reflect

Reflections are thought to be the most useful tools in this field kit. They are stand-alone statements, not questions, and contain hypotheses about what you may have noticed (sensed, heard, or seen). They are typically used to continue personal exploration and help people understand their motivations more clearly.

The simplest reflection involves repeating what you hear or see. As an example, try repeating the last couple words of what the person just said. Let it echo. This will likely prompt the other to continue to share their thoughts and feelings.

More complex reflections involve finding a deeper meaning in what you hear or see. This might include paraphrasing what you noticed, or creating metaphors to describe what you notice ("it's as if you're in the passenger seat and don't get to decide where you want to go"). These are guesses about what a person might be feeling ("that really got you down") or thinking ("it's not your fault").

<figure>
  <img
    src="/images/once-upon/its-not-your-fault.webp"
    alt="A looping clip of the therapist in Good Will Hunting facing his young patient and repeating the line captioned on screen: “It's not your fault.”"
    width="245"
    height="140"
    loading="lazy"
    decoding="async"
  />
</figure>

### Convey affirmations

Affirmations are positive statements about a person's strengths, efforts, and resources that foster a mindset of empowerment. They are particularly helpful when building rapport and when supporting a person during the process of change.

Noticing easy-to-miss positive qualities calls for a listening mindset. The more you pay attention, the more genuine, specific, and powerful the affirmations tend to be. One basic way to affirm is:

1. Name the specific strengths, efforts, and resources you noticed.
2. Name an example of a time when the person showed these positive qualities and resources.

### Summarize

Summaries are reflections that recap what the person has conveyed so far. They serve to ensure you are understanding, transition to new topics, highlight important statements, and connect different pieces of information.

Here's an example summary embracing these principles of empathizing, helping make sense, and autonomy-supportive communication:

> Let me see if I'm following you so far. You're worried about whether you'll enjoy the degree program and if you'll be able to handle the stress of working and studying at the same time. You feel overwhelmed and unsure about whether or not to go for it. At the same time, you know you want to find a job more fulfilling than the one you have now. We talked about a few steps you could take, like creating a budget. Did I get that right?

Paying attention is essential for well-crafted summaries that capture the essential elements accurately and concisely. In this summary, the listener checked their understanding of the story so far, allowing the other person to provide feedback if necessary.

## In practice

There is no singular way to learn or practice this set of skills. Initially, it might look and feel awkward and mechanical and we might feel we aren't doing it correctly. Your interlocutor might be surprised or taken aback, and you might be as well. This is normal. Find your own path while honoring the essentials of supporting autonomy, expressing empathy, and making sense of messiness.

Rather than push ourselves down by being hard on ourselves or apologizing for errors or awkwardness, we might try to pull back at how intensely we are practicing or how well we expect this to go. Notice what sticks, and discard what doesn't, finding our own voice as you practice this set of skills.

We conclude this section on Core Skills by highlighting three opportunities for tiny changes in how we might practice being bad at these difficult skills and noticing gradual improvement:

1. Pay attention to appropriate timing.

This refers to attunement and empathy to best understand how to support another person in your conversation with them.

You can do so by listening to and observing the person with you, and even ask for direct feedback if the other person is comfortable to provide it. Practices like paying attention to moment-to-moment bodily and mental awareness can help notice thoughts and perspectives that can advance a story during conversation. Just like paying attention to media can reveal patterns we can tune into (such as a three-act structure in a film, play, or novel), the ebbs and flows of our emotional responses, behavior, and speech in conversation can all become more accessible with practice and reveal story arcs.

[This clip](https://www.facebook.com/reel/976831416696128) shows an interviewer rushing to advise someone who doesn't seem ready or interested for this advice. Perhaps he could have tried reflections instead.

2. Pay attention to the order in which these skills are used.

We use these dyadic skills in a string (reflect-affirm-reflect) or on their own, depending on the purpose of communication. You can also use them by repeating which skill is being used, for example by continuing to affirm someone as you become more attuned.

3. Stay focused on potentials versus setbacks.

Shifting your attention as a listener can help channel your partner's strengths and reappraise setbacks as stepping stones along their journey toward taking a first step toward change.

We leave the *ever after* part of this story for you and your interlocutors to co-create. Who gets to choose the ending?

This framework for the curious can assist others and themselves to practice engaging with the stories we tell and identifying pathways to meaningful change. By adopting a listening mindset and drawing on tools—asking open-ended questions, advising/informing, reflective listening, affirming and summarizing—we can make subtle adjustments in our stories that can spark growth and positively shape life trajectories.

# Resources

## When in doubt, get help

Self-assessment and judgment is vital in helping you decide whether or not you are the best person to be supportive, how you can help, and if you have the right skills to do so.

It is better to err on the side of caution and seek professional help if you are unsure about your ability to help someone in need. Additionally, it can be helpful to regularly reflect on your own skills and limitations and seek training and education. For formal training in foundational skills like motivational interviewing, consult the [MINT network](https://motivationalinterviewing.org/).

By engaging in training, you can ensure the best support possible and avoid potential harm to yourself or others. The intent of making this material available is for those who would like to explore their own positive development and help others who might not be able to access formal training.

## Prioritize your needs: empower yourself to empower someone else

Practicing these skills, especially when things get heated, can puts an enormous burden on you as a listener to manage and attend to responses of the self and those of the other. And on top of that, you're practicing a new skill! The following strategies are known to reduce the overwhelm and increase mindfulness during interactions. Experiment with different tools to find what works best for you.

### Using mindfulness when practicing other skills

Mindfulness comes down to awareness–which a leading mindfulness trainer, Jon Kabat Zinn, defines as the state which "arises when we pay attention on purpose in the present moment, non-judgmentally". This awareness is essential during a conversation to take care of yourself first.

As one toolkit, A World Health Organization handbook, [*Doing what matters in times of stress: An illustrated guide*](https://www.who.int/publications/i/item/9789240003927), covers different mindfulness-based tools, such as grounding, unhooking, engaging, being kind, and making room. It is based on an evidence-based approach called Acceptance and Commitment Therapy and is available in several languages.

### Breathe to recenter in a conversation

Paying attention to your breath during a conversation can help us develop awareness of patterns in ourselves and others. This is also connected to mindfulness; practicing outside of a conversation can make it easier to practice on the spot when it feels accessible to do so. For in-the-moment practice, you can try deep, slow breathing that engages the diaphragm, the breathing muscle located under your lungs. There are free apps like this [Breathly](https://breathly.app/), and plenty of other resources, apps, and tools to learn skills like heart rate variability biofeedback. For a simple approach at home, a simple hand on the belly to notice how it expands and contracts on every breath can help, as can another hand on your carotid artery, to feel your pulse. After focusing on minute changes in your pulse, and with deep, slow breaths, you can feel your heart rate vary with each breath (with variability being easier to notice the deeper you breathe).

> [!cite]
> The science behind this: breathing changes intrathoracic pressure and blood pressure; the brainstem and baroreflex respond by withdrawing vagal tone on the inhale (heart speeds up) and restoring it on the exhale (heart slows) — respiratory sinus arrhythmia. Breathing around six breaths per minute (4 or 5 seconds inhale and 6 or 5 seconds exhale respectively) drives this loop at its resonant frequency, maximizing heart rate variability. 
>
> Lehrer PM, Gevirtz R (2014). [Heart rate variability biofeedback: how and why does it work?](https://pmc.ncbi.nlm.nih.gov/articles/PMC4104929/) Frontiers in Psychology, 5:756.

### Scripts

The more you practice these skills, the more you may begin to get a sense of the moments in which you have difficulty supporting another person the way you would like to.

Writing scripts for predictable situations may help. For example, if you tend to feel overwhelmed when the other speaks too quickly for you to process, your script might be, "Do you mind if we pause for a moment? What you just said is really important to me and I want to make sure I'm getting it". If you need help generating a script, large language models like ChatGPT or Claude can help generate different responses, or can act as a role play partner. (Just be mindful of [vulnerability amplifying feedback loops](https://www.nature.com/articles/s41591-026-04577-2).)

## Consider how culture shapes stories

Becoming aware of the cultures, countries, and other aspects of ourselves and those we talk to is crucial when practicing using these tools. For example, in an informal culture like the United States, people from other countries might be aware of how "hello, how is it going?" might seem disingenuous, while in the United States it is a routine part of daily life.

To respect and align with the values and contexts of diverse cultures, notice and approach differences in culture with openness and curiosity to be more effective.

> [!cite]
> Tools from ethnography can provide context on how researchers in the social sciences, user experience research, and other domains learn about different cultures. Jan Chipchase's [Field Study Handbook](https://studiodradiodurans.com/products/the-field-study-handbook-field-edition) has a chapter on [calibrating to various cultures](https://drive.google.com/file/d/1F9zr1pHesGPSOTtXLQu4hTxOGu7zoIRx/view?usp=sharing).
> 
> The [Culture Map](https://www.amazon.ca/Culture-Map-Breaking-Invisible-Boundaries/dp/1610392760) includes insights on cultural differences around the world, particularly applied to a business context. [🏴‍☠️ Digital Copy](https://libgen.li/index.php?req=Culture+Map+Meyer&curtab=f&order=year&ordermode=desc)
>
> The [Hofstede's tool offers](https://geerthofstede.com/country-comparison-bar-charts/) a cross-country comparison of values on different cultural dimensions (e.x., uncertainty avoidance, power distance, individualism), but this research comes with many caveats.

As an example of how cultural sensitivity is often an ideal that is hard to reach, consider how difficult translation can be. For example, Mandarin speakers we talked to for this had difficulty translating the concepts of "consent" and "autonomy", and translations differed between interviewees. Here are translations for some of the guiding principles of Once Upon: consent, autonomy, and empathy in other world languages. [Email me](mailto:j@jaan.io) if you find better translations!

| Language | Consent | Autonomy |
| :---: | :---: | :---: |
| Chinese (Mandarin) | 同意 (tóngyì) | 自主性 (zì zhǔ xìng) |
| Spanish | Consentimiento | Autonomía |
| Hindi | सहमति (sahmati) | स्वतंत्रता (svatantrata) |
| Turkish | Rıza | Otonomi |
| Arabic | موافقة (muwāfaqah) | استقلالية (istiqlaliya) |

## The dark side of tools from psychology and behavior change

Not being transparent and intending to change someone's behavior without their consent is manipulative.

The stories we tell have a profound impact on our lives, and imposing a narrative onto someone else holds the potential to manipulate, persuade or distort their very understanding of the world. This is why we focus on guiding principles such as supporting autonomy, expressing empathy, and making sense of messiness. Manipulation, deception, or any number of other harmful social engineering practices have been flagged and examined in a variety of settings. For example, see [Motivational and Psychological Triggers in Social Engineering](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3750474) and any number of behavioral economic studies on behavior change to learn about phenomena such as "priming".

Anyone can do anything with information they glean from the internet, yet we would rather ensure that there is a resource such as this available to anyone, anywhere, to help them notice these methods in use across a variety of situations, sectors, and experiences they might encounter.

In fact, there are many sets of psychological tools already in use (e.g. [Cialdini's Influence: The Psychology of Persuasion](https://dn710600.ca.archive.org/0/items/ThePsychologyOfPersuasion/The%20Psychology%20of%20Persuasion.pdf)). Being transparent with you about the misuses of these tools hopefully gives you more autonomy. Similar to the act of documenting deceptive design patterns ([https://www.deceptive.design/types](https://www.deceptive.design/types)) to make them easier to spot — and, easier to try out on unwitting subjects and running the risk of a lawsuit – we hope that maintaining this guide can highlight when someone is adept at these skills, and whether they remain supportive of autonomy, expressive of empathy, or help in sense making. And if they're not, then you might be able to tell even faster when they may be faking it or out of practice.

> This was the initial prototype of this tool; next we had hoped to raise money to integrate technology such as open source heart rate variability monitoring and build practice modules using large language models. If you know of anyone who has done this [I would love to hear about it](mailto:j@jaan.io)!

### Authors

Jaan Altosaar & the One Fact Foundation [team](https://web.archive.org/web/20240816180424/https://www.onefact.org/team) in 2022--2023. Specifically, Katherine Gibb contributed to the development of an earlier version of this resource.

### Copyright License

This was released under the <a rel="license" href="https://creativecommons.org/licenses/by-sa/4.0/">CC-BY-SA 4.0 License<img src="/images/cc/cc.svg" alt="" style="height:1.1em;display:inline;margin-left:0.2em;margin-bottom:0.08em;vertical-align:text-bottom"><img src="/images/cc/by.svg" alt="" style="height:1.1em;display:inline;margin-left:0.2em;margin-bottom:0.08em;vertical-align:text-bottom"><img src="/images/cc/sa.svg" alt="" style="height:1.1em;display:inline;margin-left:0.2em;margin-bottom:0.08em;vertical-align:text-bottom"></a> by One Fact Foundation, a nonprofit I started that ended after grant funding ended. It is republished here under the same license.

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
> A ManyMinds [podcast episode](https://disi.org/the-allure-of-stories/) featuring two researchers covering the psychology and cultural evolution of stories (i.e., why stories stick around so long).
> 
> A [talk](https://www.youtube.com/watch?v=0MtsXbTJdt8) by an human behavior researcher on the salient role of non-verbals among successful people.
> 
> Foundational psychology texts:
> [Motivational interviewing](https://www.amazon.com/Motivational-Interviewing-Helping-People-Applications/dp/1609182278/ref=sr_1_2?crid=11X33561NBFCT&keywords=Motivational+interviewing+textbook&qid=1689093354&sprefix=motivational+interviewing+textbook+%2Caps%2C84&sr=8-2) [🏴‍☠️ PDF](https://libgen.li/index.php?req=Motivational+Interviewing%3A+Helping+People+Change&order=year&ordermode=desc)
> 
> [Self-determination theory](https://www.guilford.com/books/Self-Determination-Theory/Ryan-Deci/9781462538966) [🏴‍☠️ PDF](https://libgen.li/index.php?req=Self-Determination+Theory+Basic+Psychological+Needs+in+Motivation%2C+Development%2C+and+Wellness&order=year&ordermode=desc)
> 
> [Crisis Negotiations: Managing Critical Incidents and Hostage Situations in Law Enforcement and Corrections (Routledge)](https://www.routledge.com/Crisis-Negotiations-Managing-Critical-Incidents-and-Hostage-Situations/McMains-Mullins-Young/p/book/9781138585522) [🏴‍☠️ PDF](https://libgen.li/index.php?req=Crisis+Negotiations%3A+Managing+Critical+Incidents+and+Hostage+Situations+in+Law+Enforcement+and+Corrections)
> 
> [Psychological Aspects of Crisis Negotiation](https://www.routledge.com/Psychological-Aspects-of-Crisis-Negotiation/Strentz/p/book/9781138557024) [🏴‍☠️ PDF](https://libgen.li/index.php?req=Psychological+Aspects+of+Crisis+Negotiationd)
> 
> Ingersoll, K. (Accessed 2020) Motivational interviewing for substance use disorders. UpToDate. [PDF](https://www.dropbox.com/scl/fi/5w1fuwahni29nj5vdfy10/March-2020-Motivational-interviewing-for-substance-use-disorders-UpToDate.pdf?rlkey=6hyearraywougzjwo5xio0spi&st=d19zav24&dl=0)
>
> [The Happiness Trap, Russ Harris](https://www.amazon.com/Happiness-Trap-Struggling-Living-Second-ebook/dp/B09XQBVS6B/ref=sr_1_1?crid=21CZMMIWBV2FG&keywords=happiness+trap&qid=1690916651&sprefix=happiness+trap%2Caps%2C130&sr=8-1) [🏴‍☠️ PDF](https://libgen.li/index.php?req=happiness+trap+russ+harris&order=year&ordermode=desc)
> 
> [Motivational and Psychological Triggers in Social Engineering](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3750474)
> 
> [Nonviolent Communication: A Language of Life](https://bookshop.org/p/books/nonviolent-communication-a-language-of-life-life-changing-tools-for-healthy-relationships-marshall-b-rosenberg/10180253): Life-Changing Tools for Healthy Relationships
> 
> Flow chart for a technique called [Brief Action Planning](https://www.kidneywi.org/wp-content/uploads/2019/10/BAP_flow_Chart_2014-03-01.pdf) (Center for Collaboration, Motivation, and Innovation) based on principles of motivational interviewing and behavior change & [training](https://centrecmi.ca/brief-action-planning/) for the use of this tool. Ed. Note: Diagrams like these, viewed in 2026, remind us more and more of agentic skills development for large language models.
