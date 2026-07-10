# Формат project.json для StoryLife Builder v1

Файл проекта хранит игру отдельно от редактора.

Корневой объект:

```json
{
  "version": 1,
  "projectName": "Название проекта",
  "startSceneId": "scene_1",
  "parameters": [],
  "flags": [],
  "audio": {},
  "theme": {},
  "mediaLibrary": {},
  "scenes": []
}
```

## Project

Обязательные поля:

- `version`: всегда `1`.
- `projectName`: название проекта.
- `startSceneId`: ID стартовой сцены.
- `parameters`: массив параметров.
- `flags`: массив флагов.
- `audio`: настройки музыки проекта.
- `theme`: глобальные цвета проекта.
- `mediaLibrary`: медиатека.
- `scenes`: массив сцен.

## Parameter

Параметр - число, которое может меняться по ходу игры.

```json
{
  "id": "parameter_confidence",
  "key": "Уверенность",
  "initialValue": 10,
  "minValue": 0,
  "maxValue": 100
}
```

## Flag

Флаг - true/false факт, который игра запоминает.

```json
{
  "id": "flag_helped_mom",
  "key": "Помог маме",
  "defaultValue": false
}
```

## Audio

```json
{
  "backgroundMusicPath": "",
  "musicVolume": 0.55,
  "musicFadeInSeconds": 0.8,
  "musicFadeOutSeconds": 0.8,
  "fadeMusicOnSceneSound": true,
  "sceneSoundDuckVolume": 0.18
}
```

Если файлов нет, пути оставлять пустыми.

## Theme

```json
{
  "backgroundColor": "#eee8dc",
  "textColor": "#26231f"
}
```

## Media Library

Для генерации проекта можно оставлять пустой:

```json
{
  "folders": []
}
```

## Scene

Сцена - одна нода в редакторе.

```json
{
  "id": "scene_1",
  "title": "Название сцены",
  "text": "Текст сцены.",
  "imagePath": "",
  "soundPath": "",
  "soundVolume": 1,
  "soundFadeInSeconds": 0,
  "soundFadeOutSeconds": 0,
  "layoutType": "imageTop",
  "fadeMusicOnSceneSound": true,
  "sceneType": "normal",
  "nodeColor": "blue",
  "style": {},
  "authorNotes": "",
  "position": {
    "x": 120,
    "y": 120
  },
  "choices": []
}
```

Допустимые `layoutType`:

- `imageTop`
- `imageBackground`
- `textFirst`
- `splitLayout`
- `fullImageMoment`
- `dialogueStyle`
- `noImage`

Допустимые `sceneType`:

- `normal`
- `ending`
- `important`
- `flagLogic`

Допустимые `nodeColor`:

- `slate`
- `green`
- `blue`
- `purple`
- `amber`
- `red`

## Scene Style

Рекомендуемый полный стиль:

```json
{
  "backgroundColor": "",
  "textColor": "",
  "titlePanelColor": "#fff7ed",
  "titleBorderColor": "#e7c8a0",
  "titleTextColor": "#3b2f2f",
  "titlePanelTransparent": false,
  "titlePanelWidth": 340,
  "titlePanelHeight": 70,
  "textPanelColor": "#fff7ed",
  "textBorderColor": "#e7c8a0",
  "textPanelTransparent": false,
  "textPanelWidth": 340,
  "textPanelHeight": 180,
  "titleFontSize": 22,
  "textFontSize": 16,
  "textFontFamily": "sans",
  "textAlign": "left",
  "imageOffsetX": 0,
  "imageOffsetY": 0,
  "imageScale": 1,
  "titleOffsetX": 0,
  "titleOffsetY": 30,
  "titleScale": 1,
  "textOffsetX": 0,
  "textOffsetY": 130,
  "textScale": 1,
  "choicesOffsetX": 0,
  "choicesOffsetY": 540,
  "choicesPanelColor": "#ffffff",
  "choicesBorderColor": "#d8cfc0",
  "choicesTextColor": "#26231f",
  "choicesPanelTransparent": false,
  "choicesFontSize": 15,
  "choicesPanelWidth": 320,
  "choicesPanelHeight": 56,
  "choicesScale": 1
}
```

## Choice

Выбор - связь от текущей сцены к другой сцене.

```json
{
  "id": "choice_1_1",
  "text": "Текст выбора",
  "targetNodeId": "scene_2",
  "conditionalTargets": [],
  "effects": [],
  "conditions": [],
  "conditionFailBehavior": "disabled"
}
```

Важно: `targetNodeId` должен быть ID существующей сцены.

## Choice Effects

Эффект флага:

```json
{
  "id": "effect_1",
  "type": "flag",
  "flagId": "flag_helped_mom",
  "value": true
}
```

Эффект параметра:

```json
{
  "id": "effect_2",
  "type": "parameter",
  "parameterId": "parameter_confidence",
  "operation": "add",
  "value": 10
}
```

`operation` может быть:

- `add`
- `subtract`
- `set`

## Choice Conditions

Условие по флагу:

```json
{
  "id": "condition_1",
  "type": "flag",
  "flagId": "flag_helped_mom",
  "expectedValue": true
}
```

Условие по параметру:

```json
{
  "id": "condition_2",
  "type": "parameter",
  "parameterId": "parameter_confidence",
  "operator": ">=",
  "value": 50
}
```

`operator` может быть:

- `>=`
- `>`
- `<`
- `<=`
- `==`
- `!=`

`conditionFailBehavior`:

- `disabled` - выбор виден, но заблокирован.
- `hidden` - выбор скрыт.

## Conditional Targets

Один выбор может вести в разные сцены в зависимости от условий:

```json
{
  "id": "conditional_target_1",
  "conditions": [
    {
      "id": "condition_3",
      "type": "flag",
      "flagId": "flag_helped_mom",
      "expectedValue": true
    }
  ],
  "targetSceneId": "scene_good_result"
}
```

Если условия не сработали, игра идёт по обычному `targetNodeId`.
