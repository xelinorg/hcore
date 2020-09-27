/* global document */

(function hCoreWebPage (document) {
  document.addEventListener('DOMContentLoaded', () => {
    const mainSection = document.getElementsByClassName('main')
    const colors = ['red', 'black']
    let pointer = 0
    let start = 1
    setInterval(() => {
      const color = `color: ${colors[pointer]};`
      if (!pointer) {
        pointer = 1
      } else {
        pointer = 0
      }

      const bgcolor = `background-color: ${colors[pointer]};`
      if (!start) {
        mainSection[0].innerHTML = 'hcore'
        mainSection[0].setAttribute('style', bgcolor.concat(color).concat('transition: all 3.5s ease;'))
      } else {
        start = 0
        mainSection[0].setAttribute('style', 'color: transparent;'.concat('transition: all 2s ease;'))
      }
    }, 3000)
  }, false)
}(document))
