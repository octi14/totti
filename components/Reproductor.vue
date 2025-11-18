<template>
  <div class="page">
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.1.2/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
    <div class="layout">
      <div class="sidebar">
        <div class="logo-pill">
          <span class="dot"></span>
          <p>totti player</p>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-header">
            <p class="sidebar-title">Colección</p>
            <button class="icon-mini" title="Crear nueva carpeta" @click="createNewFolder">
              <span class="material-icon tiny">create_new_folder</span>
            </button>
          </div>
          <div class="sidebar-list">
            <button
              v-for="album in albums"
              :key="album.id"
              class="sidebar-item"
              :class="{ active: albumActual && album.id === albumActual.id }"
              @click="selectAlbum(album.id)"
            >
              <div class="sidebar-thumb">
                <img :src="album.image || currentArtwork" :alt="album.nombre">
              </div>
              <div class="sidebar-metadata">
                <span class="sidebar-name">{{ album.nombre }}</span>
                <span class="sidebar-sub">{{ album.año || '—' }}</span>
              </div>
            </button>
          </div>
          <p v-if="fetchError" class="panel-hint compact">{{ fetchError }}</p>
        </div>
      </div>

      <div class="device-wrapper">
        <div class="smartphone">
          <div class="smartphone-dynamic-island"></div>
          <div class="smartphone-screen">
            <div class="status-overlay">
              <span class="status-time">{{ statusTime }}</span>
              <div class="status-icons">
                <span class="icon-signal">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span class="icon-wifi"></span>
                <span class="icon-battery">
                  <span class="battery-level"></span>
                </span>
              </div>
            </div>
            <transition name="fade">
              <div
                v-if="albumActual"
                :key="albumActual.id + '-' + currentTrackIndex"
                class="artwork"
              >
                <img :src="currentArtwork" :alt="albumActual.nombre" loading="lazy">
              </div>
            </transition>

            <transition name="slide-up">
              <div :key="trackActual ? trackActual.id || trackActual.title : 'sin-tema'" class="track-info">
                <h1 class="track-title">{{ trackActual ? normaliseTrackTitle(trackActual.title || trackActual.nombre) : '' }}</h1>
                <p class="album-name-line">{{ albumActual ? albumActual.nombre : '' }}</p>
                <span class="album-year-line">{{ albumActual && albumActual.año ? albumActual.año : '' }}</span>
              </div>
            </transition>

            <div class="control-bar">
              <div class="control-row">
                <button class="icon-button" @click="changeTrack(-1)" :disabled="!canGoPrevious">
                  <span class="material-icon">skip_previous</span>
                </button>

                <button class="play-button" @click="togglePlayPause" :disabled="isLoading || !trackActual">
                  <transition name="fade" mode="out-in">
                    <span
                      class="material-icon play-pause-icon"
                      :key="playing ? 'pause' : 'play'"
                    >
                      {{ playing ? 'pause' : 'play_arrow' }}
                    </span>
                  </transition>
                </button>

                <button class="icon-button" @click="changeTrack(1)" :disabled="!canGoNext">
                  <span class="material-icon">skip_next</span>
                </button>
              </div>

              <div class="progress-row">
                <span class="time">{{ formattedCurrentTime }}</span>
                <div class="progress-wrapper">
                  <input
                    type="range"
                    min="0"
                    :max="audioDuration"
                    v-model="currentTime"
                    @input="seekTo"
                    :disabled="isLoading || !trackActual"
                  />
                  <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
                </div>
                <span class="time">{{ formattedDuration }}</span>
              </div>

              <div class="sub-controls">
                <div class="volume-control">
                  <span class="material-icon small">volume_up</span>
                  <input type="range" min="0" max="1" step="0.01" v-model.number="volume" @input="updateVolume">
                </div>
              </div>
            </div>
          </div>
          <div class="smartphone-home"></div>
        </div>
      </div>

      <aside class="tracks-panel" v-if="albumActual">
        <div class="tracks-header">
          <div>
            <p class="panel-title">Pistas</p>
            <span class="panel-hint compact">
              {{ albumActual.tracks.length }} {{ albumActual.tracks.length === 1 ? 'tema' : 'temas' }}
            </span>
          </div>
          <button class="pill-button ghost" @click="changeTrack(1)" :disabled="!canGoNext">
            <span class="material-icon tiny">arrow_forward</span>
            Siguiente
          </button>
        </div>
        <div class="tracks-scroll">
          <button
            v-for="(track, index) in albumActual.tracks"
            :key="track.id || `${albumActual.id}-${index}`"
            class="track-chip"
            :class="{ active: currentTrackIndex === index }"
            @click="selectTrack(index)"
          >
            <span class="track-order">{{ (index + 1).toString().padStart(2, '0') }}</span>
            <div class="track-meta">
              <span class="track-meta-title">{{ normaliseTrackTitle(track.title || track.nombre) }}</span>
              <span class="track-meta-sub">{{ formatDurationDisplay(track.duration) }}</span>
            </div>
            <span class="track-duration">{{ formatDurationDisplay(track.duration) }}</span>
            <div class="track-actions" v-if="track.key">
              <button class="icon-mini success" title="Descargar" @click.stop="downloadTrack(track)">
                <span class="material-icon tiny">download</span>
              </button>
              <button class="icon-mini" title="Renombrar" @click.stop="renameTrack(track)">
                <span class="material-icon tiny">edit</span>
              </button>
              <button class="icon-mini danger" title="Eliminar" @click.stop="deleteTrack(track)">
                <span class="material-icon tiny">delete</span>
              </button>
            </div>
          </button>
        </div>
        <p v-if="!albumActual.tracks || !albumActual.tracks.length" class="panel-hint">
          Este álbum no tiene pistas detectadas.
        </p>

        <div class="manager-panel" v-if="canManageCurrentAlbum">
          <p class="panel-title">Administrar álbum</p>
          <label class="manager-label">Subir nuevo track</label>
          <div class="upload-row">
            <input type="file" ref="uploadInput" accept="audio/*" @change="handleFileChange">
            <button class="pill-button" @click="uploadSelectedFile" :disabled="!pendingFile || managerUploading">
              <span class="material-icon tiny">file_upload</span>
              {{ managerUploading ? 'Subiendo...' : 'Subir' }}
            </button>
          </div>
          <p class="panel-hint compact" v-if="pendingFile">Listo para subir: {{ pendingFile.name }}</p>
          <p class="panel-hint compact" v-if="managerMessage">{{ managerMessage }}</p>
        </div>
        <p v-else class="panel-hint">
          Este álbum proviene de datos locales; gestiona los archivos directamente en S3.
        </p>
      </aside>
    </div>
  </div>
</template>

<script>
import temas from '~/plugins/temas.js';

const GIF_POOL = temas.map((item) => item.image).filter(Boolean);

export default {
  data() {
    return {
      albums: [],
      albumActual: null,
      trackActual: null,
      currentAlbumIndex: -1,
      currentTrackIndex: -1,
      audioSource: '',
      audio: null,
      playing: false,
      isLoading: false,
      shouldAutoplay: false,
      isFetchingAlbums: false,
      fetchError: null,
      volume: 1,
      pendingFile: null,
      managerUploading: false,
      managerMessage: '',
      currentTime: 0,
      audioDuration: 0,
      statusTime: '',
      statusInterval: null,
      currentArtwork: '',
      gifPool: GIF_POOL,
      lastGifIndex: null,
      downloadingTrack: null,
    };
  },
  computed: {
    canManageCurrentAlbum() {
      return Boolean(this.albumActual && this.albumActual.prefix);
    },
    canGoPreviousTrack() {
      return this.albumActual && Array.isArray(this.albumActual.tracks) && this.currentTrackIndex > 0;
    },
    canGoNextTrack() {
      return (
        this.albumActual &&
        Array.isArray(this.albumActual.tracks) &&
        this.currentTrackIndex >= 0 &&
        this.currentTrackIndex < this.albumActual.tracks.length - 1
      );
    },
    canGoPreviousAlbum() {
      return this.currentAlbumIndex > 0;
    },
    canGoNextAlbum() {
      return this.currentAlbumIndex >= 0 && this.currentAlbumIndex < this.albums.length - 1;
    },
    canGoPrevious() {
      return this.canGoPreviousTrack || this.canGoPreviousAlbum;
    },
    canGoNext() {
      return this.canGoNextTrack || this.canGoNextAlbum;
    },
    formattedCurrentTime() {
      return this.formatTime(this.currentTime);
    },
    formattedDuration() {
      return this.formatTime(this.audioDuration || 0);
    },
    progressPercentage() {
      if (!this.audioDuration) {
        return 0;
      }
      const percent = (this.currentTime / this.audioDuration) * 100;
      return Math.min(100, Math.max(0, percent));
    },
  },
  methods: {
    async loadAlbums({ preserveSelection = true } = {}) {
      const previousAlbumId = preserveSelection && this.albumActual ? this.albumActual.id : null;
      const previousTrackKey = preserveSelection && this.trackActual ? this.trackActual.key : null;
      const wasPlaying = this.playing;

      this.isFetchingAlbums = true;
      this.fetchError = null;
      try {
        const response = await fetch('/api/s3/albums');
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const payload = await response.json();
        if (!payload || !Array.isArray(payload.albums) || !payload.albums.length) {
          throw new Error('No se encontraron álbumes en el bucket.');
        }
        this.albums = payload.albums.map((album, index) => this.mapAlbumPayload(album, index));
      } catch (error) {
        console.error('No se pudieron cargar los álbumes desde S3, usando datos locales.', error);
        this.fetchError = 'Mostrando datos locales. Verifica permisos o contenido del bucket.';
        this.albums = temas.map((tema, index) => ({
          id: tema.id || index + 1,
          nombre: tema.nombre || `Álbum ${index + 1}`,
          año: tema.año || '',
          image: tema.image || '',
          prefix: '',
          tracks: [
            {
              id: `fallback-${tema.id || index + 1}`,
              title: tema.nombre || `Pista ${index + 1}`,
              url: tema.link,
              key: '',
            },
          ],
        }));
      } finally {
        this.isFetchingAlbums = false;
      }

      if (this.albums.length) {
        if (preserveSelection && previousAlbumId) {
          const albumIndex = this.albums.findIndex((album) => album.id === previousAlbumId);
          if (albumIndex !== -1) {
            const trackIndex =
              previousTrackKey && this.albums[albumIndex].tracks
                ? this.albums[albumIndex].tracks.findIndex((track) => track.key === previousTrackKey)
                : 0;
            this.setAlbumByIndex(albumIndex, {
              trackIndex: trackIndex >= 0 ? trackIndex : 0,
              resumePlaying: wasPlaying,
            });
            return;
          }
        }
        this.setAlbumByIndex(0, { trackIndex: 0, resumePlaying: false });
      }
    },
    mapAlbumPayload(album, index) {
      const tracks = Array.isArray(album.tracks) && album.tracks.length
        ? album.tracks
        : [
            {
              id: `${album.id || index + 1}-1`,
              title: album.nombre || `Pista ${index + 1}`,
              url: album.link,
            },
          ];

      return {
        id: album.id || index + 1,
        nombre: album.nombre || `Álbum ${index + 1}`,
        año: album.año || '',
        image: album.image || '',
        link: album.link,
        prefix: album.prefix || '',
        tracks: tracks.map((track, trackIndex) => ({
          id: track.id || `${album.id || index + 1}-${trackIndex + 1}`,
          title: track.title || track.nombre || `Pista ${trackIndex + 1}`,
          url: track.url || track.link || album.link,
          art: track.art || '',
          duration: track.duration || null,
          key: track.key || track.s3Key || track.path || '',
        })),
      };
    },
    setAlbumByIndex(index, { trackIndex = 0, resumePlaying = false } = {}) {
      const album = this.albums[index];
      if (!album) {
        return;
      }
      this.albumActual = album;
      this.currentAlbumIndex = index;
      if (!Array.isArray(album.tracks) || !album.tracks.length) {
        this.trackActual = null;
        this.currentTrackIndex = -1;
        this.audioSource = '';
        this.playing = false;
        return;
      }
      const safeIndex = Math.min(Math.max(trackIndex, 0), album.tracks.length - 1);
      this.setTrackByIndex(safeIndex, resumePlaying);
    },
    setTrackByIndex(index, resumePlaying = false) {
      if (!this.albumActual || !Array.isArray(this.albumActual.tracks)) {
        return;
      }
      const track = this.albumActual.tracks[index];
      if (!track || !track.url) {
        return;
      }
      this.currentTrackIndex = index;
      this.trackActual = track;
      this.audioSource = track.url;
      this.currentTime = 0;
      this.audioDuration = 0;
      this.isLoading = true;
      this.shouldAutoplay = resumePlaying;
      this.playing = false;
      this.currentArtwork = this.getArtworkForTrack(track, this.albumActual);

      this.initAudio();
      if (this.audio) {
        this.audio.pause();
        this.audio.src = this.audioSource;
        this.audio.currentTime = 0;
        this.audio.load();
      }
    },
    changeTrack(step) {
      if (!this.albumActual) {
        return;
      }
      const resumePlaying = this.playing || this.shouldAutoplay;
      if (step > 0) {
        if (this.canGoNextTrack) {
          this.setTrackByIndex(this.currentTrackIndex + 1, resumePlaying);
        } else if (this.canGoNextAlbum) {
          this.setAlbumByIndex(this.currentAlbumIndex + 1, { trackIndex: 0, resumePlaying });
        }
      } else if (step < 0) {
        if (this.canGoPreviousTrack) {
          this.setTrackByIndex(this.currentTrackIndex - 1, resumePlaying);
        } else if (this.canGoPreviousAlbum) {
          const previousAlbumIndex = this.currentAlbumIndex - 1;
          const previousAlbum = this.albums[previousAlbumIndex];
          const lastTrackIndex =
            previousAlbum && Array.isArray(previousAlbum.tracks) && previousAlbum.tracks.length
              ? previousAlbum.tracks.length - 1
              : 0;
          this.setAlbumByIndex(previousAlbumIndex, { trackIndex: lastTrackIndex, resumePlaying });
        }
      }
    },
    selectAlbum(id) {
      const index = this.albums.findIndex((album) => album.id === id);
      if (index === -1 || index === this.currentAlbumIndex) {
        return;
      }
      const resumePlaying = this.playing || this.shouldAutoplay;
      this.setAlbumByIndex(index, { trackIndex: 0, resumePlaying });
    },
    selectTrack(index) {
      if (index === this.currentTrackIndex) {
        if (!this.playing) {
          this.togglePlayPause();
        }
        return;
      }
      this.setTrackByIndex(index, true);
    },
    initAudio() {
      if (this.audio) {
        return;
      }
      this.audio = new Audio();
      this.audio.autoplay = false;
      this.audio.preload = 'auto';
      this.audio.crossOrigin = 'anonymous';
      this.audio.volume = this.volume;
      this.audio.onended = this.onAudioEnded;
      this.audio.ontimeupdate = this.onTimeUpdate;
      this.audio.onloadedmetadata = this.onLoadedMetadata;
      this.audio.oncanplaythrough = this.onCanPlay;
    },
    onAudioEnded() {
      if (this.canGoNextTrack || this.canGoNextAlbum) {
        this.changeTrack(1);
      } else {
        this.playing = false;
      }
    },
    onTimeUpdate() {
      this.currentTime = this.audio.currentTime;
    },
    onLoadedMetadata() {
      this.audioDuration = this.audio.duration || 0;
    },
    onCanPlay() {
      this.isLoading = false;
      if (this.shouldAutoplay) {
        this.shouldAutoplay = false;
        this.playing = true;
        this.audio.play().catch(() => {
          this.playing = false;
        });
      }
    },
    togglePlayPause() {
      if (!this.audio || !this.trackActual) {
        return;
      }
      if (this.playing) {
        this.audio.pause();
        this.playing = false;
      } else {
        if (this.isLoading) {
          this.shouldAutoplay = true;
          return;
        }
        this.audio
          .play()
          .then(() => {
            this.shouldAutoplay = false;
            this.playing = true;
          })
          .catch(() => {
            this.playing = false;
          });
      }
    },
    seekTo() {
      if (!this.audio || this.isLoading) {
        return;
      }
      this.audio.currentTime = Number(this.currentTime);
    },
    formatTime(value) {
      const seconds = Math.max(0, Math.floor(value || 0));
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    formatDurationDisplay(value) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return '';
      }
      return this.formatTime(value);
    },
    getFormattedStatusTime() {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    startStatusClock() {
      this.statusTime = this.getFormattedStatusTime();
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
      }
      this.statusInterval = setInterval(() => {
        this.statusTime = this.getFormattedStatusTime();
      }, 30000);
    },
    getRandomGif() {
      if (!this.gifPool.length) {
        return '';
      }
      if (this.gifPool.length === 1) {
        this.lastGifIndex = 0;
        return this.gifPool[0];
      }
      let index = Math.floor(Math.random() * this.gifPool.length);
      if (this.lastGifIndex !== null) {
        let attempts = 0;
        while (index === this.lastGifIndex && attempts < 10) {
          index = Math.floor(Math.random() * this.gifPool.length);
          attempts += 1;
        }
      }
      this.lastGifIndex = index;
      return this.gifPool[index];
    },
    getArtworkForTrack(track, album) {
      const gif = this.getRandomGif();
      if (gif) {
        return gif;
      }
      if (track && track.art) {
        return track.art;
      }
      if (album && album.image) {
        return album.image;
      }
      return '';
    },
    normaliseTrackTitle(title = '') {
      const trimmed = title.split('/').pop();
      return trimmed ? trimmed.replace(/[_-]+/g, ' ').replace(/\.[^/.]+$/, '').trim() : 'Pista';
    },
    updateVolume() {
      if (this.audio) {
        this.audio.volume = this.volume;
      }
    },
    handleFileChange(event) {
      const file = event.target.files && event.target.files[0];
      this.pendingFile = file || null;
      this.managerMessage = '';
    },
    async uploadSelectedFile() {
      if (!this.pendingFile || !this.canManageCurrentAlbum) {
        return;
      }
      const file = this.pendingFile;
      const prefix = this.albumActual.prefix;
      const sanitizedName = this.slugifyFilename(file.name, { preserveExtension: true });
      const key = `${prefix}${sanitizedName}`;
      this.managerUploading = true;
      this.managerMessage = '';
      try {
        const uploadUrlResponse = await this.callManageApi({
          action: 'createUploadUrl',
          key,
          contentType: file.type || 'application/octet-stream',
        });
        await fetch(uploadUrlResponse.url, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: file,
        });
        this.managerMessage = `Archivo "${sanitizedName}" subido correctamente.`;
        this.pendingFile = null;
        if (this.$refs.uploadInput) {
          this.$refs.uploadInput.value = '';
        }
        await this.loadAlbums({ preserveSelection: true });
      } catch (error) {
        console.error('Error subiendo archivo', error);
        this.managerMessage = 'No se pudo subir el archivo. Revisa la consola.';
      } finally {
        this.managerUploading = false;
      }
    },
    async deleteTrack(track) {
      if (!track?.key || !this.canManageCurrentAlbum) {
        return;
      }
      const confirmed = window.confirm(`¿Seguro que quieres eliminar "${track.title}"?`);
      if (!confirmed) {
        return;
      }
      try {
        await this.callManageApi({
          action: 'deleteObject',
          key: track.key,
        });
        this.managerMessage = `Se eliminó ${track.title}.`;
        await this.loadAlbums({ preserveSelection: true });
      } catch (error) {
        console.error('Error eliminando archivo', error);
        this.managerMessage = 'No se pudo eliminar el archivo.';
      }
    },
    async renameTrack(track) {
      if (!track?.key || !this.canManageCurrentAlbum) {
        return;
      }
      const currentBaseName = this.extractBaseName(track.key);
      const newName = window.prompt('Nuevo nombre (sin extensión):', currentBaseName);
      if (!newName) {
        return;
      }
      const ext = this.extractExtension(track.key);
      const folder = track.key.includes('/') ? track.key.substring(0, track.key.lastIndexOf('/') + 1) : this.albumActual.prefix || '';
      const sanitized = this.slugifyFilename(`${newName}${ext}`, { preserveExtension: true });
      const targetKey = `${folder}${sanitized}`;
      if (targetKey === track.key) {
        return;
      }
      try {
        await this.callManageApi({
          action: 'renameObject',
          sourceKey: track.key,
          targetKey,
        });
        this.managerMessage = `Se renombró a ${sanitized}.`;
        await this.loadAlbums({ preserveSelection: true });
      } catch (error) {
        console.error('Error renombrando archivo', error);
        this.managerMessage = 'No se pudo renombrar el archivo.';
      }
    },
    async callManageApi(payload) {
      const response = await fetch('/api/s3/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || `Error ${response.status}`);
      }
      return response.json();
    },
    slugifyFilename(name, { preserveExtension = false } = {}) {
      if (!name) {
        return `archivo-${Date.now()}.mp3`;
      }
      let base = name;
      let extension = '';
      if (preserveExtension || name.includes('.')) {
        const extMatch = name.match(/\.[^/.]+$/);
        if (extMatch) {
          extension = extMatch[0];
          base = name.slice(0, -extension.length);
        }
      }
      const slug = base
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'archivo';
      return `${slug}${extension || ''}`;
    },
    extractBaseName(key) {
      const fileName = key.split('/').pop() || key;
      return fileName.replace(/\.[^/.]+$/, '');
    },
    extractExtension(key) {
      const match = key.match(/\.[^/.]+$/);
      return match ? match[0] : '';
    },
    async downloadTrack(track) {
      if (!track?.key) {
        return;
      }
      this.downloadingTrack = track.key;
      try {
        const response = await this.callManageApi({
          action: 'createDownloadUrl',
          key: track.key,
        });
        const link = document.createElement('a');
        link.href = response.url;
        const fileName = this.extractBaseName(track.key) + this.extractExtension(track.key);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.managerMessage = `Descargando ${fileName}...`;
      } catch (error) {
        console.error('Error descargando archivo', error);
        this.managerMessage = 'No se pudo descargar el archivo.';
      } finally {
        this.downloadingTrack = null;
      }
    },
    async createNewFolder() {
      const folderName = window.prompt('Nombre de la nueva carpeta:');
      if (!folderName || !folderName.trim()) {
        return;
      }
      this.managerMessage = '';
      try {
        await this.callManageApi({
          action: 'createFolder',
          folderName: folderName.trim(),
        });
        this.managerMessage = `Carpeta "${folderName.trim()}" creada correctamente.`;
        await this.loadAlbums({ preserveSelection: true });
      } catch (error) {
        console.error('Error creando carpeta', error);
        this.managerMessage = error.message || 'No se pudo crear la carpeta.';
      }
    },
  },
  async mounted() {
    await this.loadAlbums();
    this.startStatusClock();
  },
  beforeDestroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
    }
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

.page {
  min-height: 100vh;
  padding: 3rem 0;
  background: radial-gradient(circle at top, #2a2d5a, #060713 70%);
  color: #f5f5f5;
  overflow-x: hidden;
  position: relative;
  width: 100%;
}

.layout {
  width: 100vw;
  margin-left: calc(50% - 50vw);
  display: grid;
  grid-template-columns: 520px 1fr 580px;
  gap: 2.5rem;
  align-items: flex-start;
  position: relative;
  padding: 0;
}

.albums-panel,
.tracks-panel,
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: rgba(12, 14, 28, 0.72);
  border-radius: 24px;
  padding: 2rem 1.5rem;
  backdrop-filter: blur(12px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.25);
}

.sidebar {
  border-radius: 0 24px 24px 0;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.tracks-panel {
  border-radius: 24px 0 0 24px;
  padding-left: 1.5rem;
  padding-right: 1.5rem;
}

.panel-title {
  font-size: 1.25rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #aebaf7;
}

.albums-scroll {
  display: grid;
  gap: 0.75rem;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.album-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  padding: 0.9rem 1rem;
  background: rgba(28, 31, 55, 0.65);
  border: 1px solid transparent;
  border-radius: 18px;
  color: #dbe1ff;
  font-family: 'Montserrat', sans-serif;
  text-align: left;
  transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
}

.album-chip:hover {
  transform: translateY(-2px);
  background: rgba(53, 58, 101, 0.8);
}

.album-chip.active {
  border-color: rgba(93, 109, 255, 0.7);
  background: rgba(93, 109, 255, 0.2);
  box-shadow: 0 10px 25px rgba(93, 109, 255, 0.25);
}

.album-name {
  font-size: 1rem;
  font-weight: 600;
}

.album-year {
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.device-wrapper {
  display: flex;
  justify-content: center;
}

.smartphone {
  position: relative;
  width: 410px;
  height: 840px;
  background: linear-gradient(160deg, #0a0c1a 0%, #1a1e34 50%, #0f1119 100%);
  border-radius: 36px;
  padding: 8px;
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.3),
    0 0 0 4px rgba(255, 255, 255, 0.02),
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -1px 0 rgba(0, 0, 0, 0.5),
    0 20px 60px rgba(0, 0, 0, 0.8),
    0 40px 120px rgba(0, 0, 0, 0.6),
    0 0 200px rgba(93, 109, 255, 0.15);
  border: 1px solid rgba(120, 136, 255, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
}

.smartphone::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, transparent 100%);
  border-radius: 36px 36px 0 0;
  pointer-events: none;
  z-index: 1;
}

.smartphone::after {
  content: '';
  position: absolute;
  inset: 2px;
  border-radius: 34px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  pointer-events: none;
  z-index: 2;
  box-shadow:
    inset 0 2px 4px rgba(255, 255, 255, 0.1),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
}

.smartphone-dynamic-island {
  width: 160px;
  height: 32px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.95);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.6),
    0 0 0 0.5px rgba(255, 255, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  margin-bottom: 18px;
  backdrop-filter: blur(20px) saturate(180%);
  position: relative;
  z-index: 10;
}

.smartphone-dynamic-island::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 50%;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%);
  border-radius: 20px 20px 0 0;
  pointer-events: none;
}

.smartphone-screen {
  flex: 1;
  width: 100%;
  background: radial-gradient(circle at 20% 20%, rgba(65, 79, 210, 0.18), transparent 60%), rgba(8, 10, 21, 0.95);
  border-radius: 28px;
  padding: 2rem 1rem 1.8rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  position: relative;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.05),
    inset 0 2px 8px rgba(0, 0, 0, 0.4),
    0 0 40px rgba(93, 109, 255, 0.1);
  z-index: 1;
}

.smartphone-screen::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 50%),
    linear-gradient(225deg, rgba(255, 255, 255, 0.02) 0%, transparent 50%);
  border-radius: 28px;
  pointer-events: none;
  z-index: 1;
}

.status-overlay {
  position: absolute;
  top: 12px;
  left: 18px;
  right: 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  color: rgba(224, 229, 255, 0.85);
  pointer-events: none;
  z-index: 10;
}

.status-icons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon-signal {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 10px;
}

.icon-signal span {
  display: block;
  width: 2px;
  background: rgba(224, 229, 255, 0.8);
  border-radius: 999px;
}

.icon-signal span:nth-child(1) {
  height: 4px;
  opacity: 0.6;
}

.icon-signal span:nth-child(2) {
  height: 6px;
  opacity: 0.7;
}

.icon-signal span:nth-child(3) {
  height: 8px;
  opacity: 0.85;
}

.icon-signal span:nth-child(4) {
  height: 10px;
}

.icon-wifi {
  position: relative;
  width: 16px;
  height: 10px;
  border: 2px solid rgba(224, 229, 255, 0.8);
  border-bottom: none;
  border-radius: 50% 50% 0 0;
  opacity: 0.85;
}

.icon-wifi::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(224, 229, 255, 0.9);
}

.icon-battery {
  position: relative;
  width: 20px;
  height: 10px;
  border: 2px solid rgba(224, 229, 255, 0.8);
  border-radius: 3px;
  opacity: 0.9;
}

.icon-battery::after {
  content: '';
  position: absolute;
  right: -4px;
  top: 2px;
  width: 3px;
  height: 6px;
  border-radius: 1px;
  background: rgba(224, 229, 255, 0.8);
}

.battery-level {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  width: 70%;
  border-radius: 1px;
  background: linear-gradient(90deg, #7fd3ff, #a7e0ff);
}

.artwork {
  width: 100%;
  aspect-ratio: 0.85;
  border-radius: 18px;
  overflow: hidden;
  box-shadow:
    0 25px 45px rgba(9, 11, 29, 0.55),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  position: relative;
  z-index: 2;
}

.artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  animation: subtle-pan 22s ease-in-out infinite alternate;
}

.track-info {
  text-align: center;
  font-family: 'Montserrat', sans-serif;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
  z-index: 2;
}

.track-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #f4f6ff;
}

.album-name-line {
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(214, 219, 255, 0.75);
}

.album-year-line {
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  color: rgba(214, 219, 255, 0.55);
}

.control-bar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  z-index: 2;
}

.device-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(32, 36, 58, 0.6);
  border-radius: 16px;
  padding: 0.85rem 1rem;
  font-family: 'Montserrat', sans-serif;
}

.device-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: rgba(214, 219, 255, 0.6);
}

.device-source {
  font-size: 0.95rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.device-status {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #98ffa9;
}

.device-status.idle {
  color: rgba(255, 255, 255, 0.5);
}

.control-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.icon-button,
.play-button {
  border: none;
  background: rgba(45, 50, 80, 0.5);
  color: #f3f4ff;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, opacity 0.2s ease;
}

.icon-button {
  width: 40px;
  height: 40px;
  font-size: 1.25rem;
}

.play-button {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #5d6dff, #9a79ff);
  box-shadow:
    0 8px 20px rgba(106, 126, 255, 0.4),
    0 4px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  position: relative;
}

.play-button::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.3), transparent 70%);
  pointer-events: none;
}

.icon-button:disabled,
.play-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon-button:not(:disabled):hover,
.play-button:not(:disabled):hover {
  transform: scale(1.05);
  background: rgba(83, 92, 132, 0.8);
}

.play-button:not(:disabled):hover {
  background: linear-gradient(135deg, #6f7cff, #b285ff);
}

.material-icon {
  font-family: 'Material Icons', 'Montserrat', sans-serif;
  font-weight: normal;
  font-style: normal;
  font-size: 1.9rem;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
}

.play-pause-icon {
  font-size: 1.9rem;
}

.progress-row {
  display: grid;
  grid-template-columns: 54px 1fr 54px;
  align-items: center;
  gap: 0.75rem;
}

.progress-wrapper {
  position: relative;
  height: 6px;
  background: rgba(70, 78, 111, 0.6);
  border-radius: 999px;
  overflow: hidden;
}

.progress-wrapper input[type='range'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5d6dff, #9a79ff);
  border-radius: inherit;
  transition: width 0.25s ease;
}

.time {
  font-family: 'Montserrat', sans-serif;
  font-size: 0.75rem;
  color: rgba(214, 219, 255, 0.7);
}

.sub-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  min-width: 150px;
}

.volume-control .material-icon.small {
  font-size: 1.1rem;
}

.volume-control input[type='range'] {
  width: 100%;
}

.smartphone-home {
  width: 128px;
  height: 6px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.25);
  margin-top: 18px;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  position: relative;
  z-index: 2;
}

.tracks-scroll {
  display: grid;
  gap: 0.65rem;
  max-height: 520px;
  overflow-y: auto;
  padding-right: 0.35rem;
}

.track-chip {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 0.85rem;
  padding: 0.75rem 1rem;
  align-items: center;
  background: rgba(25, 28, 50, 0.55);
  border-radius: 18px;
  border: 1px solid transparent;
  color: #dbe1ff;
  font-family: 'Montserrat', sans-serif;
  text-align: left;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.track-chip:hover {
  transform: translateX(4px);
  border-color: rgba(125, 139, 255, 0.4);
  background: rgba(42, 47, 84, 0.65);
}

.track-chip.active {
  border-color: rgba(125, 139, 255, 0.7);
  background: rgba(93, 109, 255, 0.22);
  box-shadow: 0 12px 28px rgba(93, 109, 255, 0.28);
}

.track-order {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(198, 204, 255, 0.75);
}

.track-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.track-meta-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #f1f3ff;
}

.track-meta-sub {
  font-size: 0.75rem;
  color: rgba(198, 204, 255, 0.6);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.panel-hint {
  font-size: 0.75rem;
  line-height: 1.4;
  color: rgba(210, 215, 255, 0.6);
}

.panel-hint.compact {
  font-size: 0.7rem;
}

.track-duration {
  font-size: 0.75rem;
  color: rgba(210, 215, 255, 0.6);
}

.track-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.icon-mini {
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-radius: 10px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.icon-mini:hover {
  background: rgba(255, 255, 255, 0.25);
}

.icon-mini.danger {
  background: rgba(255, 99, 132, 0.2);
  color: #ff7b96;
}

.icon-mini.success {
  background: rgba(99, 255, 132, 0.2);
  color: #7bff96;
}

.manager-panel {
  margin-top: 2rem;
  padding: 1.25rem;
  border-radius: 18px;
  background: rgba(24, 27, 46, 0.6);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.manager-label {
  font-size: 0.8rem;
  color: rgba(225, 228, 255, 0.8);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.upload-row {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.upload-row input[type='file'] {
  flex: 1;
  font-size: 0.8rem;
  color: #cfd6ff;
}

.sidebar {
  background: rgba(9, 12, 24, 0.85);
  padding: 2.5rem 1.75rem;
  gap: 2rem;
}

.logo-pill {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  width: fit-content;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.9);
}

.logo-pill .dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: #7e8dff;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-title {
  font-size: 0.85rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.sidebar-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 560px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.sidebar-item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.85rem;
  align-items: center;
  padding: 0.85rem;
  background: rgba(20, 24, 45, 0.65);
  border-radius: 16px;
  border: 1px solid transparent;
  text-align: left;
  color: #eff2ff;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.sidebar-item:hover {
  transform: translateX(4px);
  border-color: rgba(127, 142, 255, 0.4);
  background: rgba(40, 45, 76, 0.75);
}

.sidebar-item.active {
  border-color: rgba(127, 142, 255, 0.8);
  background: rgba(86, 103, 255, 0.25);
  box-shadow: 0 10px 35px rgba(86, 103, 255, 0.35);
}

.sidebar-thumb {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  overflow: hidden;
}

.sidebar-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-metadata {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.sidebar-name {
  font-size: 0.95rem;
  font-weight: 600;
}

.sidebar-sub {
  font-size: 0.75rem;
  color: rgba(215, 221, 255, 0.55);
}

.tracks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pill-button {
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.95rem;
  background: rgba(86, 103, 255, 0.2);
  color: #cfd6ff;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.pill-button.ghost {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.pill-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pill-button:hover:not(:disabled) {
  background: rgba(119, 138, 255, 0.3);
  color: #ffffff;
}

.pill-button {
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.95rem;
  background: rgba(86, 103, 255, 0.2);
  color: #cfd6ff;
  font-size: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.pill-button.ghost {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
}

.pill-button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pill-button:hover:not(:disabled) {
  background: rgba(119, 138, 255, 0.3);
  color: #ffffff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease;
}

.fade-enter,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.45s ease, opacity 0.45s ease;
}

.slide-up-enter,
.slide-up-leave-to {
  transform: translateY(14px);
  opacity: 0;
}

@keyframes subtle-pan {
  from {
    transform: scale(1.05) translate3d(-2%, -1%, 0);
  }
  to {
    transform: scale(1.1) translate3d(2%, 1%, 0);
  }
}

@media (max-width: 1024px) {
  .layout {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .sidebar {
    border-radius: 0;
    padding-left: 1.5rem;
  }

  .tracks-panel {
    border-radius: 0;
    padding-right: 1.5rem;
  }

  .albums-panel {
    width: 100%;
    max-width: 640px;
    flex-direction: column;
  }

  .tracks-panel {
    width: 100%;
    max-width: 640px;
  }
}

@media (max-width: 640px) {
  .page {
    padding: 2rem 0;
  }

  .layout {
    gap: 1.5rem;
  }

  .sidebar {
    padding: 1.5rem;
    padding-left: 1.5rem;
  }

  .tracks-panel {
    padding-right: 1.5rem;
  }

  .smartphone {
    transform: scale(0.92);
  }

  .track-meta-title {
    font-size: 0.85rem;
  }
}
</style>

