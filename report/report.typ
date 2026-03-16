#set document(
  title: "NexusTickets — Εφαρμογή Διαχείρισης Εκδηλώσεων και Ηλεκτρονικών Κρατήσεων",
  author: ("Μάριος Γιαννόπουλος", "Ραμαντάν Κονόμι"),
)

#set page(
  paper: "a4",
  margin: (top: 3cm, bottom: 3cm, left: 2.5cm, right: 2.5cm),
  numbering: "1",
)

#set text(
  font: "New Computer Modern",
  size: 12pt,
  lang: "el",
)

#set par(
  justify: true,
  leading: 0.8em,
)

#set heading(numbering: "1.1")

// ─── Εξώφυλλο ───────────────────────────────────────────────────────────────

#page(numbering: none)[
  #align(center)[
    #v(2cm)

    #text(size: 14pt)[
      Τμήμα Πληροφορικής & Τηλεπικοινωνιών \
      Τεχνολογίες Εφαρμογών Διαδικτύου
    ]

    #v(3cm)

    #text(size: 20pt, weight: "bold")[
      NexusTickets
    ]

    #v(0.5cm)

    #text(size: 14pt)[
      Εφαρμογή Διαχείρισης Εκδηλώσεων και \
      Ηλεκτρονικών Κρατήσεων στον Παγκόσμιο Ιστό
    ]

    #v(3cm)

    #grid(
      columns: (1fr, 1fr),
      gutter: 1cm,
      align(center)[
        #text(weight: "bold")[Μάριος Γιαννόπουλος] \
        #text(size: 10pt)[ΑΜ: 1115202000032]
      ],
      align(center)[
        #text(weight: "bold")[Ραμαντάν Κονόμι] \
        #text(size: 10pt)[ΑΜ: 1115201800281]
      ],
    )

    #v(2cm)

    #text(size: 11pt)[
      Αθήνα, Ιούνιος 2026
    ]
  ]
]

// ─── Πίνακας Περιεχομένων ────────────────────────────────────────────────────

#page(numbering: none)[
  #outline(
    title: "Πίνακας Περιεχομένων",
    indent: auto,
    depth: 2,
  )
]

// ─── Κυρίως Κείμενο ─────────────────────────────────────────────────────────

#counter(page).update(1)

= Εισαγωγή

= Αρχιτεκτονική Συστήματος

= Σχεδιασμός Βάσης Δεδομένων

= Υλοποίηση Backend

= Υλοποίηση Frontend

= Αυθεντικοποίηση και Ασφάλεια

= Σύστημα Συστάσεων

= Δοκιμές

= Επίλογος