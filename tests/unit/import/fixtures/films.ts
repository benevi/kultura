// ============================================================
// 500 películas reales (título como lo enseña Letterboxd · año) para el
// fixture de aceptación de F-26. Hay de todo lo que complica emparejar:
// comas y comillas (van entre comillas en el CSV), dos puntos, guiones,
// acentos, "&", títulos no ingleses, secuelas y títulos con remake.
// ============================================================

const RAW = `
The Shawshank Redemption|1994
The Godfather|1972
The Dark Knight|2008
The Godfather Part II|1974
12 Angry Men|1957
Schindler's List|1993
The Lord of the Rings: The Return of the King|2003
Pulp Fiction|1994
The Lord of the Rings: The Fellowship of the Ring|2001
"The Good, the Bad and the Ugly"|1966
Forrest Gump|1994
Fight Club|1999
The Lord of the Rings: The Two Towers|2002
Inception|2010
Star Wars: Episode V – The Empire Strikes Back|1980
The Matrix|1999
Goodfellas|1990
One Flew Over the Cuckoo's Nest|1975
Se7en|1995
It's a Wonderful Life|1946
Seven Samurai|1954
The Silence of the Lambs|1991
Saving Private Ryan|1998
City of God|2002
Interstellar|2014
Life Is Beautiful|1997
The Green Mile|1999
Star Wars|1977
Terminator 2: Judgment Day|1991
Back to the Future|1985
Spirited Away|2001
The Pianist|2002
Psycho|1960
Parasite|2019
Léon: The Professional|1994
The Lion King|1994
Gladiator|2000
American History X|1998
The Departed|2006
The Usual Suspects|1995
The Prestige|2006
Whiplash|2014
Casablanca|1942
Harakiri|1962
The Intouchables|2011
Modern Times|1936
Once Upon a Time in the West|1968
Rear Window|1954
Alien|1979
City Lights|1931
Apocalypse Now|1979
Memento|2000
Django Unchained|2012
Indiana Jones and the Raiders of the Lost Ark|1981
WALL·E|2008
The Lives of Others|2006
Sunset Boulevard|1950
Paths of Glory|1957
The Shining|1980
The Great Dictator|1940
Avengers: Infinity War|2018
Witness for the Prosecution|1957
Aliens|1986
Spider-Man: Into the Spider-Verse|2018
American Beauty|1999
"Dr. Strangelove or: How I Learned to Stop Worrying and Love the Bomb"|1964
The Dark Knight Rises|2012
Oldboy|2003
Joker|2019
Amadeus|1984
Braveheart|1995
Toy Story|1995
Coco|2017
Inglourious Basterds|2009
Das Boot|1981
Princess Mononoke|1997
Avengers: Endgame|2019
Once Upon a Time in America|1984
Good Will Hunting|1997
Your Name.|2016
Toy Story 3|2010
Requiem for a Dream|2000
Singin' in the Rain|1952
3 Idiots|2009
Star Wars: Episode VI – Return of the Jedi|1983
2001: A Space Odyssey|1968
Reservoir Dogs|1992
Eternal Sunshine of the Spotless Mind|2004
High and Low|1963
Citizen Kane|1941
Lawrence of Arabia|1962
M|1931
North by Northwest|1959
Vertigo|1958
Amélie|2001
Capernaum|2018
A Clockwork Orange|1971
Double Indemnity|1944
Full Metal Jacket|1987
Scarface|1983
The Hunt|2012
To Kill a Mockingbird|1962
The Sting|1973
Up|2009
Heat|1995
L.A. Confidential|1997
Metropolis|1927
Die Hard|1988
Snatch|2000
Bicycle Thieves|1948
Taxi Driver|1976
Downfall|2004
Incendies|2010
Batman Begins|2005
For a Few Dollars More|1965
Green Book|2018
The Wolf of Wall Street|2013
Some Like It Hot|1959
The Kid|1921
Judgment at Nuremberg|1961
The Father|2020
All About Eve|1950
Top Gun: Maverick|2022
Ran|1985
Casino|1995
Unforgiven|1992
There Will Be Blood|2007
Pan's Labyrinth|2006
The Truman Show|1998
The Sixth Sense|1999
Shutter Island|2010
A Beautiful Mind|2001
Jurassic Park|1993
Yojimbo|1961
The Treasure of the Sierra Madre|1948
Monty Python and the Holy Grail|1975
No Country for Old Men|2007
The Great Escape|1963
Kill Bill: Vol. 1|2003
Rashomon|1950
The Thing|1982
Finding Nemo|2003
The Elephant Man|1980
Chinatown|1974
Raging Bull|1980
V for Vendetta|2005
Gone with the Wind|1939
Lock, Stock and Two Smoking Barrels|1998
Inside Out|2015
Dial M for Murder|1954
The Secret in Their Eyes|2009
Howl's Moving Castle|2004
Three Billboards Outside Ebbing, Missouri|2017
The Bridge on the River Kwai|1957
Trainspotting|1996
Prisoners|2013
Warrior|2011
Fargo|1996
Gran Torino|2008
My Neighbor Totoro|1988
Catch Me If You Can|2002
Million Dollar Baby|2004
Children of Heaven|1997
Blade Runner|1982
The Gold Rush|1925
Before Sunrise|1995
12 Years a Slave|2013
Klaus|2019
Harry Potter and the Deathly Hallows: Part 2|2011
Ben-Hur|1959
Gone Girl|2014
The Grand Budapest Hotel|2014
On the Waterfront|1954
In the Name of the Father|1993
The General|1926
Wild Strawberries|1957
Barry Lyndon|1975
The Deer Hunter|1978
Hacksaw Ridge|2016
Memories of Murder|2003
Sherlock Jr.|1924
Wild Tales|2014
The Wages of Fear|1953
Mr. Smith Goes to Washington|1939
Mad Max: Fury Road|2015
Mary and Max|2009
How to Train Your Dragon|2010
Room|2015
The Seventh Seal|1957
Monsters, Inc.|2001
Jaws|1975
Dead Poets Society|1989
Ratatouille|2007
Tokyo Story|1953
The Big Lebowski|1998
Rocky|1976
Ford v Ferrari|2019
Logan|2017
The Terminator|1984
Spotlight|2015
Hotel Rwanda|2004
Platoon|1986
The Passion of Joan of Arc|1928
Before Sunset|2004
The Exorcist|1973
La Haine|1995
Rush|2013
The Incredibles|2004
Stand by Me|1986
Hachi: A Dog's Tale|2009
The Wizard of Oz|1939
Into the Wild|2007
Network|1976
The Best Years of Our Lives|1946
The 400 Blows|1959
Pirates of the Caribbean: The Curse of the Black Pearl|2003
Gangs of Wasseypur|2012
The Handmaiden|2016
Persona|1966
8½|1963
La Dolce Vita|1960
Andrei Rublev|1966
Stalker|1979
Solaris|1972
Mirror|1975
Ikiru|1952
Tokyo Godfather|2003
Grave of the Fireflies|1988
Akira|1988
Perfect Blue|1997
Ghost in the Shell|1995
Paprika|2006
The Wind Rises|2013
Nausicaä of the Valley of the Wind|1984
Castle in the Sky|1986
Kiki's Delivery Service|1989
Porco Rosso|1992
Ponyo|2008
The Boy and the Heron|2023
Weathering with You|2019
A Silent Voice|2016
Drive My Car|2021
Shoplifters|2018
Burning|2018
Decision to Leave|2022
Train to Busan|2016
The Wailing|2016
I Saw the Devil|2010
Mother|2009
Snowpiercer|2013
Okja|2017
In the Mood for Love|2000
Chungking Express|1994
"Crouching Tiger, Hidden Dragon"|2000
Hero|2002
Farewell My Concubine|1993
Raise the Red Lantern|1991
Yi Yi|2000
A Brighter Summer Day|1991
Infernal Affairs|2002
Everything Everywhere All at Once|2022
Past Lives|2023
Aftersun|2022
The Banshees of Inisherin|2022
Tár|2022
The Fabelmans|2022
Oppenheimer|2023
Barbie|2023
Killers of the Flower Moon|2023
Poor Things|2023
Anatomy of a Fall|2023
The Zone of Interest|2023
Perfect Days|2023
Dune|2021
Dune: Part Two|2024
Challengers|2024
Furiosa: A Mad Max Saga|2024
Inside Out 2|2024
The Substance|2024
Anora|2024
Conclave|2024
The Brutalist|2024
Flow|2024
Wicked|2024
A Real Pain|2024
I'm Still Here|2024
Emilia Pérez|2024
The Wild Robot|2024
Nosferatu|2024
Civil War|2024
Longlegs|2024
Late Night with the Devil|2024
Love Lies Bleeding|2024
Kinds of Kindness|2024
Sing Sing|2024
Nickel Boys|2024
All We Imagine as Light|2024
The Seed of the Sacred Fig|2024
Society of the Snow|2023
The Holdovers|2023
May December|2023
Saltburn|2023
Godzilla Minus One|2023
Spider-Man: Across the Spider-Verse|2023
John Wick: Chapter 4|2023
Guardians of the Galaxy Vol. 3|2023
The Super Mario Bros. Movie|2023
Talk to Me|2022
Bottoms|2023
Asteroid City|2023
Fallen Leaves|2023
The Taste of Things|2023
American Fiction|2023
Maestro|2023
The Iron Claw|2023
Napoleon|2023
Wonka|2023
Priscilla|2023
Monster|2023
Evil Does Not Exist|2023
The Teachers' Lounge|2023
Robot Dreams|2023
20 Days in Mariupol|2023
Top Gun|1986
Ghostbusters|1984
Gremlins|1984
The Goonies|1985
E.T. the Extra-Terrestrial|1982
Close Encounters of the Third Kind|1977
Raiders of the Lost Ark|1981
Indiana Jones and the Last Crusade|1989
Who Framed Roger Rabbit|1988
Beetlejuice|1988
Edward Scissorhands|1990
Batman|1989
The Princess Bride|1987
Ferris Bueller's Day Off|1986
The Breakfast Club|1985
Dirty Dancing|1987
Ghost|1990
Pretty Woman|1990
Home Alone|1990
The Silence of the Lambs|1991
Thelma & Louise|1991
Point Break|1991
Basic Instinct|1992
Groundhog Day|1993
Mrs. Doubtfire|1993
Philadelphia|1993
Speed|1994
The Mask|1994
Dumb and Dumber|1994
Four Weddings and a Funeral|1994
Clueless|1995
Toy Story 2|1999
Jumanji|1995
Twelve Monkeys|1995
Independence Day|1996
Scream|1996
Jerry Maguire|1996
Titanic|1997
Men in Black|1997
Face/Off|1997
The Fifth Element|1997
Boogie Nights|1997
The Big Short|2015
Arrival|2016
Blade Runner 2049|2017
Sicario|2015
Enemy|2013
Incendies|2011
Moonlight|2016
La La Land|2016
Lady Bird|2017
Get Out|2017
Us|2019
Nope|2022
Hereditary|2018
Midsommar|2019
The Witch|2015
The Lighthouse|2019
Uncut Gems|2019
Good Time|2017
Marriage Story|2019
Little Women|2019
Frances Ha|2012
The Florida Project|2017
Call Me by Your Name|2017
Portrait of a Lady on Fire|2019
Phantom Thread|2017
Roma|2018
The Irishman|2019
Once Upon a Time... in Hollywood|2019
1917|2019
Jojo Rabbit|2019
Knives Out|2019
Glass Onion: A Knives Out Mystery|2022
The Social Network|2010
Black Swan|2010
Drive|2011
Her|2013
Gravity|2013
Birdman or (The Unexpected Virtue of Ignorance)|2014
Nightcrawler|2014
Ex Machina|2014
It Follows|2014
The Babadook|2014
Mad Max|1979
The Revenant|2015
Carol|2015
Anomalisa|2015
The Lobster|2015
Paterson|2016
Manchester by the Sea|2016
The Handmaiden|2016
Toni Erdmann|2016
Silence|2016
Dunkirk|2017
The Shape of Water|2017
Annihilation|2018
Roma|2018
Cold War|2018
First Reformed|2017
Burning|2018
Pain and Glory|2019
Soul|2020
Nomadland|2020
Minari|2020
Promising Young Woman|2020
The Power of the Dog|2021
The Worst Person in the World|2021
Titane|2021
Licorice Pizza|2021
The French Dispatch|2021
West Side Story|2021
West Side Story|1961
A Star Is Born|2018
A Star Is Born|1954
Little Shop of Horrors|1986
Suspiria|1977
Suspiria|2018
The Fly|1986
Scarface|1932
Ocean's Eleven|2001
Ocean's Eleven|1960
True Grit|2010
True Grit|1969
Dune|1984
Halloween|1978
Halloween|2018
Psycho|1998
The Thing from Another World|1951
King Kong|1933
King Kong|2005
Planet of the Apes|1968
Rise of the Planet of the Apes|2011
The Day the Earth Stood Still|1951
Invasion of the Body Snatchers|1978
Ghost in the Shell|2017
RoboCop|1987
Total Recall|1990
Starship Troopers|1997
The Truman Show|1998
Being John Malkovich|1999
Magnolia|1999
Fight Club|1999
American Psycho|2000
Almost Famous|2000
O Brother, Where Art Thou?|2000
Mulholland Drive|2001
Donnie Darko|2001
The Royal Tenenbaums|2001
Shrek|2001
Spirited Away|2001
28 Days Later|2002
Lost in Translation|2003
Kill Bill: Vol. 2|2004
Shaun of the Dead|2004
Hot Fuzz|2007
The World's End|2013
Scott Pilgrim vs. the World|2010
Zodiac|2007
Ratatouille|2007
Juno|2007
Superbad|2007
Children of Men|2006
The Fountain|2006
Little Miss Sunshine|2006
Brokeback Mountain|2005
Kiss Kiss Bang Bang|2005
Pride & Prejudice|2005
Mean Girls|2004
Collateral|2004
Napoleon Dynamite|2004
Big Fish|2003
Elf|2003
Love Actually|2003
School of Rock|2003
Mystic River|2003
Old Boy|2013
Biutiful|2010
Open Your Eyes|1997
The Others|2001
Talk to Her|2002
All About My Mother|1999
Volver|2006
The Skin I Live In|2011
Parallel Mothers|2021
Women on the Verge of a Nervous Breakdown|1988
Cría cuervos|1976
The Spirit of the Beehive|1973
Viridiana|1961
Mar adentro|2004
El Bola|2000
Cell 211|2009
The Orphanage|2007
[REC]|2007
The Platform|2019
Marshland|2014
Champions|2018
Alcarràs|2022
The Beasts|2022
Close Your Eyes|2023
The Motive|2017
Ocho apellidos vascos|2014
Torrente, el brazo tonto de la ley|1998
Los lunes al sol|2002
Belle Époque|1992
Abre los ojos|1997
Tesis|1996
El día de la bestia|1995
Jamón, jamón|1992
Lucía y el sexo|2001
Truman|2015
La isla mínima|2014
Mientras dure la guerra|2019
El reino|2018
As bestas|2022
`

/** [título, año] en el orden del CSV (sin repetir título + año). */
export const FILMS: Array<[string, number]> = (() => {
  const seen = new Set<string>()
  const out: Array<[string, number]> = []
  for (const line of RAW.split('\n')) {
    const m = line.trim().match(/^"?(.*?)"?\|(\d{4})$/)
    if (!m) continue
    const key = `${m[1]}|${m[2]}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push([m[1], Number(m[2])])
  }
  return out.slice(0, 500)
})()
