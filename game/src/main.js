// Solmar City — boot and the game loop.
// The page is a full-viewport canvas. The loop steps the world at a
// fixed 1/60 and draws it; the title, pause, story-card and end
// screens are states, not separate pages. With ?shot=<name> in the
// URL the game stages one screenshot scene instead of playing.
import { createWorld, stepWorld } from './world.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { drawHUD, drawTitle, drawPause, drawEnd, drawCard } from './hud.js';
import { stageShot } from './shots.js';
import { loadSave, saveGame, clearSave } from './save.js';
import { STORY } from './config.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || 1);

function resize(renderer) {
  renderer.resize(window.innerWidth, window.innerHeight);
  if (renderer.world) {
    renderer.world.viewW = window.innerWidth;
    renderer.world.viewH = window.innerHeight;
  }
}

function boot() {
  const renderer = createRenderer(canvas);
  resize(renderer);

  if (shotName) {
    // Screenshot mode: stage the scene, draw one frame, stop.
    const world = stageShot(shotName, shotSeed);
    world.viewW = window.innerWidth;
    world.viewH = window.innerHeight;
    renderer.world = world;
    renderer.render(world);
    drawHUD(renderer.ctx, world, window.innerWidth, window.innerHeight);
    document.title = `Solmar City — shot: ${shotName}`;
    window.__shotReady = true;
    window.__world = world;
    window.addEventListener('resize', () => {
      resize(renderer);
      renderer.render(world);
      drawHUD(renderer.ctx, world, window.innerWidth, window.innerHeight);
    });
    return;
  }

  const input = createInput(canvas);
  const save = loadSave();
  let world = null;
  let lastSavedMissions = -1;

  function newGame(useSave) {
    const data = useSave ? save : null;
    const seed = data && data.seed ? data.seed : Math.floor(Math.random() * 100000) + 1;
    world = createWorld(seed, data);
    world.input = input;
    world.viewW = window.innerWidth;
    world.viewH = window.innerHeight;
    world.hasSave = !!save;
    world.state = 'title';
    renderer.world = world;
    window.__world = world;
    lastSavedMissions = world.stats.missionsDone;
    if (statusEl) statusEl.textContent = 'Solmar City. Press Enter for a new game.';
  }

  newGame(false);

  function respawn() {
    const hospital = world.city.landmarks.hospital || { x: 2400, y: 1000 };
    world.player.x = hospital.x;
    world.player.y = hospital.y + 40;
    world.player.inCar = false;
    world.player.car = null;
    world.player.health = 100;
    world.camera.x = world.player.x;
    world.camera.y = world.player.y;
    world.state = 'playing';
    world.addMessage('Patched up at St. Lucia. Back to work.');
  }

  window.addEventListener('keydown', (event) => {
    if (!world) return;
    world.audio.ensure();
    world.audio.startMusic();
    if (event.code === 'Enter' || event.code === 'NumpadEnter') {
      if (world.state === 'title') {
        world.state = 'playing';
        world.audio.ensure();
        world.audio.startMusic();
        world.addMessage('Welcome to Solmar City. Follow the yellow marker.');
      } else if (world.state === 'story') {
        world.dismissCard();
      } else if (world.state === 'busted' || world.state === 'wasted') {
        respawn();
      }
    }
    if (event.code === 'KeyC' && world.state === 'title' && save) {
      newGame(true);
      world.state = 'playing';
      world.addMessage('Welcome back, Rico.');
    }
    if (event.code === 'KeyM') {
      world.audio.setMuted(!world.audio.muted);
      world.addMessage(world.audio.muted ? 'Sound off.' : 'Sound on.');
    }
    if ((event.code === 'KeyP' || event.code === 'Escape') && (world.state === 'playing' || world.state === 'paused')) {
      world.state = world.state === 'playing' ? 'paused' : 'playing';
    }
    if (event.code === 'KeyR' && world.state === 'paused') {
      clearSave();
      newGame(false);
      world.state = 'playing';
    }
  });
  canvas.addEventListener('mousedown', () => {
    if (!world) return;
    world.audio.ensure();
    world.audio.startMusic();
    if (world.state === 'story') world.dismissCard();
  });

  window.addEventListener('resize', () => resize(renderer));

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    if (!world) return;
    if (world.state === 'playing') {
      stepWorld(world, input, dt);
      if (world.stats.missionsDone !== lastSavedMissions) {
        lastSavedMissions = world.stats.missionsDone;
        saveGame(world);
      }
    } else if (world.state === 'busted' || world.state === 'wasted') {
      world.stateTimer += dt;
    }
    renderer.render(world);
    if (world.state === 'playing') {
      drawHUD(renderer.ctx, world, window.innerWidth, window.innerHeight);
    } else if (world.state === 'title') {
      drawTitle(renderer.ctx, world, window.innerWidth, window.innerHeight);
    } else if (world.state === 'paused') {
      drawHUD(renderer.ctx, world, window.innerWidth, window.innerHeight);
      drawPause(renderer.ctx, world, window.innerWidth, window.innerHeight);
    } else if (world.state === 'story') {
      drawHUD(renderer.ctx, world, window.innerWidth, window.innerHeight);
      drawCard(renderer.ctx, world, window.innerWidth, window.innerHeight);
    } else if (world.state === 'busted' || world.state === 'wasted') {
      drawEnd(renderer.ctx, world, window.innerWidth, window.innerHeight, world.state);
    }
    input.clearPressed();
  }
  requestAnimationFrame(frame);
}

boot();
