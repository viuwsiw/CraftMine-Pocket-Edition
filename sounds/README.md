# Звуки CraftMine PE

Записанные звуки игры. Все взяты из **свободных наборов с лицензией CC0** (общественное достояние) с OpenGameArt.org
и обработаны (обрезка, моно 22 кГц, выравнивание громкости) скриптом `tools/import-sounds.py`.
При сборке (`android/build.sh`) папка встраивается в `js/sound_pack.js` скриптом `tools/pack-sounds.py`.

Имя файла: `<событие>_<номер>.ogg`. Несколько файлов одного события — варианты, игра выбирает случайный
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
