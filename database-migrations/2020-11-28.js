let matches =
      [
        {
          matchId: 89,
          dotaMatchId: 5322097573
        },
        {
          matchId: 88,
          dotaMatchId: 5322191671
        },
        {
          matchId: 87,
          dotaMatchId: 5326140780
        },
        {
          matchId: 86,
          dotaMatchId: 5326263042
        },
        {
          matchId: 106,
          dotaMatchId: 5336631587
        },
        {
          matchId: 105,
          dotaMatchId: 5336733102
        },
        {
          matchId: 108,
          dotaMatchId: 5351779940
        },
        {
          matchId: 110,
          dotaMatchId: 5351862743
        },
        {
          matchId: 112,
          dotaMatchId: 5366713002
        },
        {
          matchId: 111,
          dotaMatchId: 5366834042
        },
        {
          matchId: 114,
          dotaMatchId: 5380923590
        },
        {
          matchId: 113,
          dotaMatchId: 5381007530
        },
        {
          matchId: 116,
          dotaMatchId: 5394889189
        },
        {
          matchId: 115,
          dotaMatchId: 5394984491
        },
        {
          matchId: 118,
          dotaMatchId: 5408284405
        },
        {
          matchId: 119,
          dotaMatchId: 5408381968
        },
        {
          matchId: 121,
          dotaMatchId: 5421386629
        },
        {
          matchId: 122,
          dotaMatchId: 5421475113
        },
        {
          matchId: 124,
          dotaMatchId: 5433456474
        },
        {
          matchId: 125,
          dotaMatchId: 5433555737
        },
        {
          matchId: 126,
          dotaMatchId: 5433622554
        },
        {
          matchId: 127,
          dotaMatchId: 5472661510
        },
        {
          matchId: 128,
          dotaMatchId: 5603122015
        },
        {
          matchId: 129,
          dotaMatchId: 5603196806
        },
        {
          matchId: 130,
          dotaMatchId: 5623589316
        },
        {
          matchId: 131,
          dotaMatchId: 5623645876
        },
        {
          matchId: 132,
          dotaMatchId: 5633479872
        },
        {
          matchId: 133,
          dotaMatchId: 5633544430
        },
        {
          matchId: 134,
          dotaMatchId: 5643190415
        },
        {
          matchId: 135,
          dotaMatchId: 5643288013
        },
        {
          matchId: 141,
          dotaMatchId: 5653068492
        },
        {
          matchId: 140,
          dotaMatchId: 5653157560
        },
        {
          matchId: 142,
          dotaMatchId: 5662505681
        },
        {
          matchId: 143,
          dotaMatchId: 5662578910
        },
        {
          matchId: 144,
          dotaMatchId: 5672072831
        },
        {
          matchId: 145,
          dotaMatchId: 5672135553
        },
        {
          matchId: 146,
          dotaMatchId: 5682623941
        },
        {
          matchId: 147,
          dotaMatchId: 5682701180
        },
        {
          matchId: 153,
          dotaMatchId: 5693090276
        },
        {
          matchId: 152,
          dotaMatchId: 5693144498
        },
        {
          matchId: 156,
          dotaMatchId: 5702801544
        },
        {
          matchId: 157,
          dotaMatchId: 5702861147
        },
        {
          matchId: 158,
          dotaMatchId: 5702923979
        },
        {
          matchId: 161,
          dotaMatchId: 5712409700
        },
        {
          matchId: 162,
          dotaMatchId: 5712497937
        },
        {
          matchId: 163,
          dotaMatchId: 5712564267
        }
      ]

matches = matches.map((m) => {
  return {
    ...m,
    phraseId: (m.dotaMatchId % 18) + 1
  }
})

console.log(matches)
