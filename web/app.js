const button = document.querySelector('#update-button');
const routesElement = document.querySelector('#routes');
const statusElement = document.querySelector('#status');
const updatedElement = document.querySelector('#updated-at');
const template = document.querySelector('#route-template');
const mapCanvas = document.querySelector('#route-map');
const mapNotice = document.querySelector('#map-notice');
const mapLegend = document.querySelector('#map-legend');
const mapContext = mapCanvas.getContext('2d');

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

const highlightLabels = {
  fastest: 'Fastest',
  'second-fastest': 'Second fastest',
  slowest: 'Slowest',
  tied: 'Same duration',
};

const routeColors = {
  fastest: '#2d9b67',
  'second-fastest': '#e58a18',
  slowest: '#d5483e',
  tied: '#e58a18',
  default: '#1769e0',
};

function routeColor(route) {
  return routeColors[route.highlight] || routeColors.default;
}

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  const readValue = () => {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += readValue();
    longitude += readValue();
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

function worldPoint(point, zoom) {
  const size = 256 * 2 ** zoom;
  const latitude = Math.max(-85.05112878, Math.min(85.05112878, point.latitude));
  const sinLatitude = Math.sin(latitude * Math.PI / 180);
  return {
    x: ((point.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * size,
  };
}

function renderMap(routes) {
  const mappedRoutes = routes
    .filter((route) => !route.error && route.encoded_polyline)
    .map((route) => ({ ...route, points: decodePolyline(route.encoded_polyline) }))
    .filter((route) => route.points.length > 1);

  mapLegend.replaceChildren();
  if (!mappedRoutes.length) {
    mapCanvas.hidden = true;
    mapNotice.hidden = false;
    mapNotice.textContent = 'No route geometry was returned for the map.';
    return;
  }

  mapCanvas.hidden = false;
  mapNotice.hidden = true;
  const width = mapCanvas.clientWidth;
  const height = mapCanvas.clientHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  mapCanvas.width = Math.round(width * pixelRatio);
  mapCanvas.height = Math.round(height * pixelRatio);
  mapContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const points = mappedRoutes.flatMap((route) => route.points);
  let zoom = 0;
  let bounds;
  for (let candidate = 18; candidate >= 0; candidate -= 1) {
    const projected = points.map((point) => worldPoint(point, candidate));
    const xs = projected.map((point) => point.x);
    const ys = projected.map((point) => point.y);
    const candidateBounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    if (candidateBounds.maxX - candidateBounds.minX <= width - 64 && candidateBounds.maxY - candidateBounds.minY <= height - 64) {
      zoom = candidate;
      bounds = candidateBounds;
      break;
    }
  }
  if (!bounds) {
    const projected = points.map((point) => worldPoint(point, zoom));
    bounds = { minX: Math.min(...projected.map((point) => point.x)), maxX: Math.max(...projected.map((point) => point.x)), minY: Math.min(...projected.map((point) => point.y)), maxY: Math.max(...projected.map((point) => point.y)) };
  }
  const left = (bounds.minX + bounds.maxX - width) / 2;
  const top = (bounds.minY + bounds.maxY - height) / 2;
  const tiles = [];
  const tileCount = 2 ** zoom;
  for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x += 1) {
    for (let y = Math.floor(top / 256); y <= Math.floor((top + height) / 256); y += 1) {
      if (y < 0 || y >= tileCount) continue;
      const image = new Image();
      image.src = `https://tile.openstreetmap.org/${zoom}/${((x % tileCount) + tileCount) % tileCount}/${y}.png`;
      image.onload = () => drawMap();
      tiles.push({ x, y, image });
    }
  }

  function drawMap() {
    mapContext.fillStyle = '#dce8ee';
    mapContext.fillRect(0, 0, width, height);
    tiles.forEach((tile) => {
      if (tile.image.complete && tile.image.naturalWidth) mapContext.drawImage(tile.image, tile.x * 256 - left, tile.y * 256 - top, 256, 256);
    });
    mappedRoutes.forEach((route) => {
      const color = routeColor(route);
      mapContext.beginPath();
      route.points.forEach((point, index) => {
        const projected = worldPoint(point, zoom);
        if (index === 0) mapContext.moveTo(projected.x - left, projected.y - top);
        else mapContext.lineTo(projected.x - left, projected.y - top);
      });
      mapContext.strokeStyle = '#ffffff';
      mapContext.lineWidth = 7;
      mapContext.stroke();
      mapContext.strokeStyle = color;
      mapContext.lineWidth = 4;
      mapContext.stroke();
    });
  }

  mappedRoutes.forEach((route) => {
    const item = document.createElement('span');
    item.innerHTML = `<i style="background:${routeColor(route)}"></i>`;
    item.append(route.name);
    mapLegend.append(item);
  });
  drawMap();
}

function renderRoutes(routes) {
  routesElement.replaceChildren();
  routes.forEach((route) => {
    const card = template.content.cloneNode(true);
    const article = card.querySelector('.route-card');
    card.querySelector('h2').textContent = route.name;
    const tags = [];
    if (route.recommended) tags.push('Google recommended');
    if (route.highlight) {
      tags.push(highlightLabels[route.highlight]);
      article.classList.add(route.highlight);
    }
    card.querySelector('.tag').textContent = tags.join(' · ');
    if (route.error) {
      article.classList.add('failed');
      card.querySelector('.metrics').hidden = true;
      card.querySelector('.error').textContent = route.error;
    } else {
      card.querySelector('.duration').textContent = formatDuration(route.duration_seconds);
      card.querySelector('.distance').textContent = `${(route.distance_meters / 1000).toFixed(1)} km`;
    }
    routesElement.append(card);
  });
}

button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Updating…';
  statusElement.textContent = 'Fetching live traffic routes…';
  try {
    const response = await fetch('/api/update', { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to update routes.');
    renderRoutes(data.routes);
    renderMap(data.routes);
    if (data.routes.some((route) => !route.error)) {
      updatedElement.textContent = `Last successful update: ${new Date().toLocaleString()}`;
    }
    statusElement.textContent = data.routes.some((route) => route.error) ? 'Some routes could not be updated.' : '';
  } catch (error) {
    statusElement.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Update Routes';
  }
});
