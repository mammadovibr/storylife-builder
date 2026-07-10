# Чеклист проверки project.json

Перед тем как отдавать файл пользователю, Custom GPT должен проверить:

## JSON

- JSON валидный.
- Нет Markdown.
- Нет ```json.
- Нет комментариев.
- Нет запятых после последнего элемента.

## Project

- `version` равен `1`.
- `projectName` не пустой.
- `startSceneId` существует среди `scenes`.
- `parameters` существует, даже если пустой массив.
- `flags` существует, даже если пустой массив.
- `audio` существует.
- `theme` существует.
- `mediaLibrary` существует.
- `scenes` существует и не пустой.

## Scenes

У каждой сцены есть:

- `id`
- `title`
- `text`
- `imagePath`
- `soundPath`
- `soundVolume`
- `soundFadeInSeconds`
- `soundFadeOutSeconds`
- `layoutType`
- `fadeMusicOnSceneSound`
- `sceneType`
- `nodeColor`
- `style`
- `authorNotes`
- `position`
- `choices`

## Choices

У каждого выбора есть:

- `id`
- `text`
- `targetNodeId`
- `conditionalTargets`
- `effects`
- `conditions`
- `conditionFailBehavior`

## Links

- Каждый `targetNodeId` указывает на существующую сцену.
- Каждый `targetSceneId` в `conditionalTargets` указывает на существующую сцену.
- Нет связей через название сцены.

## Flags and Parameters

- Каждый `flagId` в `effects` существует в `flags`.
- Каждый `flagId` в `conditions` существует в `flags`.
- Каждый `parameterId` в `effects` существует в `parameters`.
- Каждый `parameterId` в `conditions` существует в `parameters`.

## Recommended Story Quality

- В стартовой сцене есть хотя бы 2 выбора.
- У важных выборов есть последствия.
- У концовок `sceneType` равен `ending`.
- Сцены расположены слева направо по `position.x`.
- Ветки не должны все сходиться сразу, если пользователь просит разветвленную историю.
