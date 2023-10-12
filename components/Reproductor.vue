<template>
  <div class="flex transform ease delay-150 justify-center min-h-screen min-w-screen sm:items-center sm:pt-0">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.1.2/dist/tailwind.min.css" rel="stylesheet">
    <div class="mx-auto sm:px-6 lg:px-8">
      <div class="shadow-lg audio-player sm:rounded-lg" :style="{backgroundImage: 'url(' + temaActual.image + ')'}">
        <!-- <div class="image mx-auto">
          <img class="max-w-full max-h-full mb-3 imagen-tema" :src="temaActual.image" alt="Imagen del tema" />
        </div> -->
        <!-- Personalizado reproductor de audio -->
        <div class="audio-controls flex-row">
          <button @click="cambiarTema(-1)" :disabled="temaActual.id === 1">
            <svg class="w-8 h-8 text-gray-500 hover:text-white transition-transform transform hover:scale-110" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M4 5h3v10H4V5zm12 0v10l-9-5 9-5z"/></svg>
          </button>
          <div v-if="isLoading" class="w-8 h-8 text-gray-600 animate-spin">
            <!-- Spinner aquí -->
            <!-- Puedes personalizar el spinner aquí con HTML o utilizar una librería de iconos -->
            <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
          </div>
          <div class="flex items-center space-x-2" v-else>
            <button @click="togglePlayPause">
              <svg v-if="!playing" class="w-8 h-8 text-gray-600 hover:text-white transition-transform transform hover:scale-110" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5 4.536v10.928a.5.5 0 0 0 .822.384l7.975-5.464a.5.5 0 0 0 0-.848l-7.975-5.464A.5.5 0 0 0 5 4.536z"/></svg>
              <svg v-else class="w-5 h-8 text-gray-500 hover:text-white transition-transform transform hover:scale-110" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M3 2a1 1 0 0 1 1 1v14a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1zm13 0a1 1 0 0 1 1 1v14a1 1 0 0 1-2 0V3a1 1 0 0 1 1-1z"/></svg>
            </button>
            <input
              type="range"
              class="w-64"
              min="0"
              :max="audioDuration"
              v-model="currentTime"
              @input="seekTo"
              :disabled="isLoading"
            />
          </div>
          <button @click="cambiarTema(1)" :disabled="temaActual.id === temas.length">
            <svg class="w-8 h-8 text-gray-500 hover:text-white transition-transform transform hover:scale-110" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M13 5h3v10h-3V5zM4 5l9 5-9 5V5z"/></svg>
          </button>
        </div>
        <!-- Fin del reproductor personalizado -->
        <div>
          <h1 class="details text-xl text-gray-100 text-center">{{ temaActual.nombre }}</h1>
          <h5 class="text-sm text-center text-gray-400 font-semibold mt-2">{{ temaActual.año }}</h5>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import temas from '~/plugins/temas.js';
export default {
  data() {
    return {
      playing: false,
      isLoading: false,
      audioSource: temas[0].link,
      temaActual: temas[0],
      temas: temas,
      audio: null,
      currentTime: 0, // Guarda el tiempo actual de reproducción
      audioDuration: 0, // Guarda la duración total del audio
    };
  },
  methods: {
    initAudio() {
      this.audio = new Audio();
      this.audio.src = this.audioSource;
      this.audio.load();
      this.audio.autoplay = false; // Evita la reproducción automática
      this.audio.addEventListener('ended', () => {
        this.cambiarTema(1); // Cambia al siguiente tema al finalizar
      });
      this.audio.addEventListener('timeupdate', () => {
        this.currentTime = this.audio.currentTime;
      });
      this.audio.addEventListener('loadedmetadata', () => {
        this.audioDuration = this.audio.duration;
      });
    },
    togglePlayPause() {
      if (this.audio) {
        if (this.playing) {
          this.audio.pause();
        } else {
          this.audio.play();
        }
        this.playing = !this.playing;
      }
    },
    cambiarTema(direccion) {
      const nuevoIndice = this.temaActual.id + direccion;
      if (nuevoIndice >= 1 && nuevoIndice <= this.temas.length) {
        this.temaActual = this.temas[nuevoIndice - 1];
        this.audioSource = this.temaActual.link;
        this.isLoading = true; // Indicar que se está cargando el audio
        if (this.audio) {
          this.audio.pause();
          this.audio.src = this.audioSource;
          this.audio.load();
          this.audio.addEventListener('canplaythrough', () => {
            this.isLoading = false; // Indicar que se ha cargado el audio
            this.playing = false;
            if (this.playing) {
              this.audio.play();
            }
          });
        }
      }
    },
    seekTo() {
      if (this.audio) {
        this.audio.currentTime = this.currentTime;
      }
    },
  },
  mounted() {
    this.initAudio();
  },
};
</script>

<style scoped>
@font-face {
  font-family: 'Montserrat';
  src: url('~/assets/fonts/Montserrat-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

.audio-player {
  background-position: center;
  background-repeat: no-repeat;
  background-size:cover;
  text-align: center;
  height: 650px;
  width: 426px;
}

.audio-controls {
  float: bottom;
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 500px;
}

.player-button {
  color: #8083a7;
  cursor: pointer;
  transition: transform 0.2s, color 0.2s;
}

.player-button:hover {
  transform: scale(1.1);
  color: #ffffff;
}

.playing {
  transform: scale(1.1);
  color: #ffffff;
}

h1{
  font-family: 'Montserrat', sans-serif;
  font-weight: bold;
}

.details{
  text-shadow: 1px 1px #0000006d;
  /* font-family: 'Montserrat', sans-serif; */
}
</style>
