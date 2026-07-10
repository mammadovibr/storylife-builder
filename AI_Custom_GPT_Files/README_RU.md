# StoryLife Builder: файлы для Custom GPT

Эту папку можно загрузить в Custom GPT как knowledge-файлы.

Цель: чтобы ChatGPT мог брать обычное описание истории и превращать его в готовый `project.json` для StoryLife Builder.

## Какие файлы здесь есть

- `CUSTOM_GPT_INSTRUCTIONS_RU.md` - главная инструкция для поведения Custom GPT.
- `PROJECT_FORMAT_STORYLIFE_V1_RU.md` - описание формата проекта StoryLife Builder v1.
- `storylife_project_template.json` - пустой шаблон проекта.
- `example_life_story_project.json` - пример готовой маленькой истории.
- `PROMPT_TEMPLATE_FOR_USER_RU.md` - текст, который можно давать Custom GPT вместе с идеей истории.
- `VALIDATION_CHECKLIST_RU.md` - список проверок перед ответом.

## Как использовать

1. Открой создание Custom GPT.
2. В инструкции Custom GPT вставь текст из `CUSTOM_GPT_INSTRUCTIONS_RU.md`.
3. В knowledge загрузи все файлы из этой папки.
4. Когда пишешь историю, проси GPT вернуть только JSON.
5. Сохрани ответ как `project.json`.
6. В StoryLife Builder нажми `Load Project` и выбери этот файл.

## Важно

Custom GPT должен возвращать именно JSON, без Markdown, без пояснений и без ```json.

Если GPT вставит комментарии или текст вокруг JSON, файл может не открыться.
