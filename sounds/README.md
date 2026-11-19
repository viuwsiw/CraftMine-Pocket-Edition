# Звуки CraftMine PE

Записанные звуки игры. Все взяты из **свободных наборов** с OpenGameArt.org: большинство — **CC0** (общественное достояние), некоторые — **CC-BY** (нужно указать автора — указано ниже) и один — **CC-BY-SA** (корова: файлы `mob_cow_*` распространяются под той же лицензией CC-BY-SA 3.0)
и обработаны (обрезка, моно 22 кГц, выравнивание громкости) скриптом `tools/import-sounds.py`.
При сборке (`android/build.sh`) папка встраивается в `js/sound_pack.js` скриптом `tools/pack-sounds.py`.

Имя файла: `<событие>_<номер>.mp3`. Несколько файлов одного события — варианты, игра выбирает случайный
и чуть меняет высоту. Для событий без файлов (свинья, курица, шипение крипера, лук, огниво, ножницы, щелчки)
играют звуки, синтезированные в `js/sound.js`. Свой звук можно положить сюда с тем же именем и пересобрать.

| События | Набор (CC0) | Автор |
|---|---|---|
| шаги по камню, песку, траве | Fantozzi's Footsteps (Grass/Sand & Stone) | qubodup |
| шаги по гравию и снегу | 42 Snow and Gravel Footsteps | qubodup |
| ломание камня, дерева, стекла | 75 CC0 breaking/falling/hit sfx | rubberduck |
| дерево (шаги, удары по блоку), стрела в блоке | 35 Wooden Cracks/Hits/Destructions | qubodup |
| удары | 37 Hits/Punches | qubodup |
| стекло | Glass Break | TinyWorlds |
| урон игрока | 15 Vocal Male Strain/Hurt/Pain/Jump Sounds | qubodup |
| еда | 7 Eating Crunches | StarNinjas |
| подбор предмета | 3 Pop Sounds | wubitog |
| взрыв | Chunky Explosion | Joth |
| фитиль | Simple Fuse Sound | themightyglider |
| двери | 100 CC0 metal and wood sfx | rubberduck |
| всплеск | 40 CC0 water / splash / slime sfx | rubberduck |
| корова | Sci-fi Aliens and Cows Pack | qubodup |
| овца | Sheep Baa | AntumDeluge |
| зомби | 16 Monster Growls | StarNinjas |
| скелет | Bones Rattle | congusbongus |
| паук | Insect or alien scream (short); 80 CC0 creature SFX | qubodup; rubberduck |
| шаги по траве, гравию, дереву, в воде | Footsteps on different surfaces — **CC-BY 3.0** | congusbongus |
| шаги по дереву, камню, гравию, земле | Different steps on wood, stone, leaves, gravel and mud (CC0) | TinyWorlds |
| копание, кирка, топор, шаги по траве, крафт, инвентарь, сундук, еда, всплеск | Cozy Farm SFX — **CC-BY 4.0** | roberto mellado |
| камень (ломание) | Breaking Rock (CC0) | themightyglider |
| щелчки кнопок | 51 UI sound effects (CC0) | Kenney |
| сундук | Open chest SFX (CC0) | Oiboo |
| двери | 4 Door Closes (CC0) | StarNinjas |
| свинья | Pig SFX pack — **CC-BY 3.0** | Vinrax |
| курица | Chicken Sound Effect — **CC-BY 3.0** | IMadeIt |
| овца | Sheep sound bleats (Yo Frankie!) — **CC-BY 3.0** | Lamoot |
| корова, свинья, овца, ягнёнок | Farm Animals (Mudchute) — **CC-BY-SA 3.0** | qubodup |
| треск огня | Fire Crackling (CC0) | AntumDeluge |
| птицы | Ambient Bird Sounds (CC0) | isaiah658 |
| сверчки | Crickets ambient noise (CC0) | Wolfgang_ |
