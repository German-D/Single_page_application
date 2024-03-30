const pokemonApi = 'https://api.pokemonbattle.me/v2/pokemons'
const baseURI = 'https://api.pokemonbattle.me/v2'
// const trainer_token = ''

// Выберём заранее все необходимые элементы
// У нас две формы - одна для создания покемона, другая - для получения/удаления покемона
// Элементы формы для создания покемона будут с префиксом "store..."
const storePokemonForm = document.querySelector('#storePokemonForm') // сама форма
// Один элемент можно выбрать с помощью .querySelector или с помощью .getElementById
// querySelector мощнее в плане того, что с помощью него можно найти - мы не ограничены только ID
// getElementById быстрее, но практически всегда этим можно пренебречь
const storeFormTrainerToken = document.getElementById('storeFormTrainerToken') // токен тренера
const storeFormPokemonName = document.querySelector('#storeFormPokemonName') // имя покемона
const storeFormPokemonPhotoURL = document.querySelector('#storeFormPokemonPhotoURL') // ссылка на изображение для сервера
const storeFormSubmitButton = document.getElementById('storeFormSubmitButton')

const storeFormShowName = document.querySelector('#storeFormShowName')
const storeFormShowPhoto = document.querySelector('#storeFormShowPhoto')
const storeFormShowId = document.querySelector('#storeFormShowId')

// Элементы формы для получения покемона будут с префиксом "get..."
const getPokemonForm = document.querySelector('#getPokemonForm') // сама форма получения
const getFormPokemonId = document.querySelector('#getFormPokemonId') // ID покемона
// Чекбокс, показывающий, нужно ли проститься с покемоном (убить)
const getFormGoodbyeCheckbox = document.getElementById('getFormGoodbyeCheckbox')
const getFormSubmitButton = document.querySelector('#getFormSubmitButton') // Кнопка отправки формы получения

const getPokemonImg = document.querySelector('#getPokemonImg') // Изображение покемона на форме получения
const getFormPokemonName = document.querySelector('#getFormPokemonName') // Имя покемона
const getFormTrainerToken = document.querySelector('#getFormTrainerToken') // Токен тренера (для убийства)

const paramsInPokeball = document.querySelector('#paramsInPokeball') // Параметры покемона - в покеболле?
const paramsIsDead = document.querySelector('#paramsIsDead') // Параметры - он мёртв?
const paramsAttack = document.querySelector('#paramsAttack') // Параметр - показатель атаки
const paramsStub = document.querySelector('#paramsStub') // Заглушка "параметры покемона", отображается, пока никто не загружен

// Повесим обработчик, слушающий отправку формы сохранения покемона
storePokemonForm.addEventListener('submit', (e) => {
  // Когда в HTML-форме нажимается кнопка отправки (submit) - форма тут же нас пытается
  // Куда-то перенаправить. Даже если в адресе действия формы ничего не стоит.
  // Для этого мы получаем в параметрах функции событие и отменяем его обычное поведение
  e.preventDefault()

  resetStoreForm()
  // Вызываем функцию "сохранить покемона"
  storePokemon()
})

// Повесим обработчик, слушающий отправку формы получения покемона
getPokemonForm.addEventListener('submit', async (e) => {
  // Отмение обычное поведение
  e.preventDefault()
  // Сбросим всё отображение формы до дефолтного - если у нас был загружен уже покемон.
  // Гораздо проще привести всё к стандартному виду, после чего наполнить нужными данными
  resetGetForm()
  // Если отменчен чекбокс "Проститься с другом" - то выполним сперва команду удаления покемона
  if (getFormGoodbyeCheckbox.checked) {
    await killPokemon()
  }
  // А потом уже его отобразим
  await getPokemon()
})

// Повесим обработчик на нажатие чекбокса "проститься с другом"
// Так как у нас в одной форме объединена функциональность запроса покемона с его удалением,
// то если чекбокс отмечен - то мы сперва удалим покемона (постараемся), после чего
// уже получим. Конечно, это не самый лучший образец UX, но так как вводить токен необходимо каждый раз - вряд ли
// это приведёт к случайным нажатиям
getFormGoodbyeCheckbox.addEventListener('click', () => {
  // Здесь у нас одна задача - если чекбокс не отмечен, то поле ввода токена должно быть скрыто
  // Если отмечен - наоборот - показано
  getFormTrainerToken.parentElement.style.visibility = getFormGoodbyeCheckbox.checked ? 'visible' : 'hidden'

  // При удалении токен тренера - обязателен.
  // А вот запрос можно осуществлять без него. Как быть? Очень просто
  // Будем делать его то обязательным, то необязательным
  getFormTrainerToken.required = false
  if (getFormGoodbyeCheckbox.checked) {
    getFormTrainerToken.required = true
  }
})

// Сделаем функцию-"обёртку" над Fetch - стандартным API http-запросов, которое есть в любом современном браузере
// Fetch API - это огромный шаг по удобству применения по сравнению с XMLHttpRequest (https://learn.javascript.ru/xmlhttprequest)
// Раньше все запросы из браузера делались через XMLHttpRequest (jQuery Ajax и Axios - обёртки над ним)
// Но Fetch API всё равно ещё довольно "простоват" для реальной работы: нужно вручную отслеживать
// исключения, ошибки и таймауты. Так как запросы HTTP - очень ненадёжная вещь, нам нужно проверить
// кучу ситуаций и отловить кучу ошибок Однако это уже гораздо удобнее и можно жить.
//
// В реальных проектах скорее всего будут встречаться Axios (XMLHttpRequst) или Ky (Fetch API)
//
// Эта функция-обёртка будет обрабатывать ошибки, а отдавать нам чистый и хороший ответ
const httpclient = async (path, payload = null, method = 'GET', headers = null) => {
  let request = {
    method: method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  // Если нам передали заголовки - то добавим их к имеющимся
  if (headers) {
    for (const [header, value] of Object.entries(headers)) {
      request.headers[header] = value
    }
  }

  if (method === 'POST' && payload) {
    request.body = JSON.stringify(payload)
  }

  let response = {}
  let json = {}
  // Встроим проверку на случай того, если запрос не получится осуществить
  try {
    response = await fetch(path, request)
    json = await response.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      alert('Ошибка, проверьте консоль')
      console.log('Получили не JSON, вот это неожиданность')
    } else {
      alert('Ошибка, проверьте консоль')
      console.log('Ошибка при выполнении запроса: ', error)
    }
    // Вернём null как знак того, что возникла ошибка
    return null
  }

  // Мало осуществить запрос - сервер может отклонить его и прислать сообщение об ошибке
  // В том случае, если мы смогли получить ответ и прочитать из него JSON:
  if (response && json) {
    if (!response.ok) {
      alert('Ошибка, проверьте консоль')
      console.log('Сервер не ответил положительно: ', json.message)
      return null
    }
    // Ура, всё сработало, возвращаем наш ответ json
    return json
  }
  return null
}

// Функция запроса информации о покемоне
const getPokemon = async () => {
  // Получим токен тренера
  // Получим ID покемона и сформируем путь запроса
  const pokemon_id = getFormPokemonId.value
  const path = `${pokemonApi}?pokemon_id=${pokemon_id}`

  // Отключим кнопку до момента получения ответа
  getFormSubmitButton.disabled = true
  const pokemon = await httpclient(path)
  getFormSubmitButton.disabled = false

  // Если наш HTTP-клиент не вернул покемона - можно сразу выходить, ошибки уже в консоли
  if (!pokemon) {
    return null
  }

  let RIP = ''
  // Покемон мёртв?
  // Сервер отдаёт статус покемона жив (1) - мёртв (0) в виде текста,
  // поэтому, чтобы использовать его в логическом выражении - приведём его к числу
  if (!Number(pokemon.status)) {
    // приложим к тегу IMG фильтр, делающий картинку серой.
    getPokemonImg.style.filter = 'grayscale(100%)'
    paramsIsDead.style.display = ''
    RIP = 'RIP '
  }
  // Выведем изображение Покемона
  getPokemonImg.src = baseURI + pokemon.photo

  // Выведем имя покемона
  getFormPokemonName.textContent = RIP + pokemon.name

  // Спрячем заглушку параметров
  paramsStub.style.display = 'none'

  // Покемон в покеболле?
  if (Number(pokemon.in_pokeball)) {
    paramsInPokeball.style.display = ''
  }

  // Выведем атаку
  paramsAttack.textContent = `Атака ${pokemon.attack}`
  paramsAttack.classList.remove('disabled')
}

// Отправим покемона на закланье
const killPokemon = async () => {
  // Наша "нагрузка" в этом чёрном деле - ID покемона, которого нужно "мементо в море"
  const payload = {
    pokemon_id: getFormPokemonId.value,
  }
  // Отключим кнопку отправки на время
  getFormSubmitButton.disabled = true
  const response = await httpclient(`${pokemonApi}/kill`, payload, 'POST', { trainer_token: getFormTrainerToken.value })
  // Так как функция убийства покемона опасна - сотрём на всякий случай токен. Понадобится - введут ещё раз
  getFormTrainerToken.value = ''
  // Разблокируем кнопку
  getFormSubmitButton.disabled = false
}

const storePokemon = async () => {
  // Отправим запрос на сервер
  // Здесь нашей полезной нагрузкой является имя покемона и ссылка на изображение
  const payload = {
    name: storeFormPokemonName.value,
    photo: storeFormPokemonPhotoURL.value,
  }

  // Заблокируем кнопку отправки на время
  storeFormSubmitButton.disabled = true
  // Отправляем запрос на сервер, дожидаемся
  const result = await httpclient(pokemonApi, payload, 'POST', { trainer_token: storeFormTrainerToken.value })
  if (!result) {
    return null
  }
  // Итак, мы получили ответ. Но это не объект с покемоном - это объект с ID покемона и сообщением об успехе
  // Запросим покемона и отобразим в форме отправки
  const pokemon = await httpclient(`${pokemonApi}?pokemon_id=${result.id}`)
  storeFormShowId.textContent = pokemon.data[0].id
  storeFormShowName.textContent = pokemon.data[0].name
  storeFormShowPhoto.src = pokemon.data[0].photo
  storeFormSubmitButton.disabled = false
}

// Скинем отображение в форме создания покемона в дефолтные значения
function resetStoreForm() {
  storeFormShowId.textContent = 'ID покемона'
  storeFormShowName.textContent = 'Имя покемона'
  storeFormShowPhoto.src = 'static/img/default_pokemon.svg'
}

// Скинем отображение в форме получения покемона в дефолтные значения
function resetGetForm() {
  getPokemonImg.style.filter = ''
  paramsIsDead.style.display = 'none'
  getPokemonImg.src = 'static/img/default_pokemon.svg'
  getFormPokemonName.textContent = 'Имя покемона'
  paramsInPokeball.style.display = 'none'
  paramsAttack.classList.add('disabled')
  paramsStub.style.display = ''
}
