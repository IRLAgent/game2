import './style.css'

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size to fit mobile screens
function resizeCanvas() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspectRatio = 4 / 3;
  
  if (width / height > aspectRatio) {
    // Width constrained
    canvas.style.height = height + 'px';
    canvas.style.width = (height * aspectRatio) + 'px';
  } else {
    // Height constrained
    canvas.style.width = width + 'px';
    canvas.style.height = (width / aspectRatio) + 'px';
  }
}

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Initial resize
resizeCanvas();

// Resize on orientation change or window resize
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
  setTimeout(resizeCanvas, 100);
});

// Player object
const player = {
  x: canvas.width / 2 - 35,
  y: canvas.height - 120,
  width: 70,
  height: 45,
  speed: 6,
  dx: 0,
  animationFrame: 0
};

// Obstacles array
const obstacles = [];
const obstacleSpeed = 4;
const obstacleSpawnRate = 60; // Lower = more frequent
let frameCount = 0;

// Game state
let gameOver = false;
let score = 0;
let highScore = localStorage.getItem('highScore') || 0;
let explosionParticles = [];
let bonusParticles = [];
let showGameOverText = false;
let scoreFlashTime = 0;

// Keyboard state
const keys = {};

// Event listeners for keyboard
window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
  keys[e.key] = false;
});

// Touch controls for mobile
let touchStartX = 0;
let touchCurrentX = 0;
let isTouching = false;

document.addEventListener('touchstart', (e) => {
  // Handle restart button first if game is over
  if (gameOver) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
    const touchY = (touch.clientY - rect.top) * (canvas.height / rect.height);
    
    const buttonWidth = 250;
    const buttonHeight = 60;
    const buttonX = canvas.width / 2 - buttonWidth / 2;
    const buttonY = canvas.height / 2 + 60;
    
    if (touchX >= buttonX && touchX <= buttonX + buttonWidth &&
        touchY >= buttonY && touchY <= buttonY + buttonHeight) {
      e.preventDefault();
      resetGame();
      return;
    }
    return; // Don't handle movement when game is over
  }
  
  // Movement controls
  touchStartX = e.touches[0].clientX;
  touchCurrentX = touchStartX;
  isTouching = true;
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  if (gameOver) return;
  e.preventDefault();
  if (isTouching) {
    touchCurrentX = e.touches[0].clientX;
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  if (gameOver) return;
  isTouching = false;
  touchStartX = 0;
  touchCurrentX = 0;
}, { passive: false });

// Update player movement
function updatePlayer() {
  player.dx = 0;
  
  // Keyboard controls
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
    player.dx = -player.speed;
  }
  if (keys['ArrowRight'] || keys['d'] || keys['D']) {
    player.dx = player.speed;
  }
  
  // Touch controls - move player to follow finger
  if (isTouching) {
    const canvasRect = canvas.getBoundingClientRect();
    const canvasX = touchCurrentX - canvasRect.left;
    const canvasRelativeX = (canvasX / canvasRect.width) * canvas.width;
    const targetX = canvasRelativeX - player.width / 2;
    const diff = targetX - player.x;
    
    if (Math.abs(diff) > 2) {
      player.dx = Math.sign(diff) * player.speed;
    }
  }
  
  player.x += player.dx;
  
  // Update animation frame when moving
  if (player.dx !== 0) {
    player.animationFrame += 0.15; // Slower animation
  }
  
  // Keep player within canvas bounds
  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }
}

// Create obstacles
function createObstacle() {
  const y = -20;
  const minGap = 70; // Minimum gap for player to fit through (player width is 70)
  const positions = [];
  const maxAttempts = 20;
  
  // Create multiple individual bananas
  const numBananas = Math.floor(Math.random() * 2) + 1; // 1-2 bananas
  
  for (let i = 0; i < numBananas; i++) {
    let placed = false;
    
    for (let attempt = 0; attempt < maxAttempts && !placed; attempt++) {
      const width = 30; // Single banana width
      const x = Math.random() * (canvas.width - width);
      const speed = Math.random() * 3 + 2; // Random speed between 2-5
      
      // Check if this position is valid
      let valid = true;
      for (let pos of positions) {
        // Check for overlap or insufficient gap
        if (x < pos.x + pos.width && x + width > pos.x) {
          valid = false;
          break;
        }
        // Check if gap between obstacles is sufficient
        const leftGap = x - (pos.x + pos.width);
        const rightGap = pos.x - (x + width);
        if ((leftGap > 0 && leftGap < minGap) || (rightGap > 0 && rightGap < minGap)) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        positions.push({ x, width });
        const isBonus = Math.random() < 0.2; // 1 in 5 chance to be a bonus banana
        const isGrowing = !isBonus && Math.random() < 0.15; // 15% chance to be growing (not both)
        obstacles.push({
          x: x,
          y: y,
          width: width,
          height: 20,
          speed: speed,
          originalSpeed: speed,
          isBonus: isBonus,
          hasTransformed: false,
          isGrowing: isGrowing,
          scale: 1.5,
          targetScale: 4.5,
          rotation: Math.random() * Math.PI * 2 // Random rotation angle
        });
        placed = true;
      }
    }
  }
  
  // Ensure there's at least one guaranteed passable gap
  if (positions.length > 0) {
    positions.sort((a, b) => a.x - b.x);
    
    // Check gaps between obstacles and at edges
    let hasValidGap = false;
    
    // Check left edge
    if (positions[0].x >= minGap) hasValidGap = true;
    
    // Check between obstacles
    for (let i = 0; i < positions.length - 1; i++) {
      const gap = positions[i + 1].x - (positions[i].x + positions[i].width);
      if (gap >= minGap) hasValidGap = true;
    }
    
    // Check right edge
    const lastPos = positions[positions.length - 1];
    if (canvas.width - (lastPos.x + lastPos.width) >= minGap) hasValidGap = true;
    
    // If no valid gap exists, remove a random banana to guarantee a path
    if (!hasValidGap && positions.length > 1) {
      const removeIndex = Math.floor(Math.random() * positions.length);
      const removedPos = positions[removeIndex];
      const indexToRemove = obstacles.findIndex(
        obs => obs.x === removedPos.x && obs.y === y
      );
      if (indexToRemove !== -1) {
        obstacles.splice(indexToRemove, 1);
      }
    }
  }
}

// Update obstacles
function updateObstacles() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].y += obstacles[i].speed;
    
    // Transform bonus bananas to yellow (ripe) halfway down
    if (obstacles[i].isBonus && !obstacles[i].hasTransformed && obstacles[i].y >= canvas.height / 2) {
      obstacles[i].hasTransformed = true;
    }
    
    // Transform growing bananas to black at 1/3 down and slow them
    if (obstacles[i].isGrowing && !obstacles[i].hasTransformed && obstacles[i].y >= canvas.height / 3) {
      obstacles[i].hasTransformed = true;
      obstacles[i].speed = obstacles[i].originalSpeed * 0.5; // Slow down to half speed
    }
    
    // Grow the black bananas
    if (obstacles[i].isGrowing && obstacles[i].hasTransformed && obstacles[i].scale < obstacles[i].targetScale) {
      obstacles[i].scale += 0.03; // Grow gradually
      if (obstacles[i].scale > obstacles[i].targetScale) {
        obstacles[i].scale = obstacles[i].targetScale;
      }
    }
    
    // Remove obstacles that are off screen and increase score
    if (obstacles[i].y > canvas.height) {
      obstacles.splice(i, 1);
      score += 10;
    }
  }
  
  // Spawn new obstacles
  frameCount++;
  if (frameCount % obstacleSpawnRate === 0) {
    createObstacle();
  }
}

// Draw a banana
function drawBanana(x, y, width, isBonus, isGrowing, scale, rotation) {
  const bx = x;
  
  ctx.save();
  
  // Apply scaling and rotation from center
  const centerX = bx + 15;
  const centerY = y + 10;
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation || 0);
  ctx.scale(scale, scale);
  
  // Banana body - black if growing, yellow if bonus/ripe, green if normal
  let bodyColor = '#32CD32'; // Green by default
  let shadowColor = '#228B22';
  let highlightColor = '#90EE90';
  
  if (isGrowing) {
    bodyColor = '#1a1a1a';
    shadowColor = '#000000';
    highlightColor = '#333333';
  } else if (isBonus) {
    bodyColor = '#FFD700'; // Yellow when ripe/edible
    shadowColor = '#DAA520';
    highlightColor = '#FFFFE0';
  }
  
  // Draw banana outline with proper curve - wider in middle, tapered at ends
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  // Left end (top of banana) - thin
  ctx.moveTo(-15, -3);
  // Curve down and widen
  ctx.bezierCurveTo(-13, -5, -8, -6, -3, -5.5);
  // Widen to middle
  ctx.bezierCurveTo(3, -5, 8, -4, 12, -2);
  // Right end (bottom of banana) - thin
  ctx.bezierCurveTo(14, -1, 15, 0, 15, 1);
  // Curve back along bottom edge
  ctx.bezierCurveTo(15, 2, 14, 3, 12, 3.5);
  // Bottom edge - wider in middle
  ctx.bezierCurveTo(8, 4, 3, 4.5, -3, 4);
  // Continue to left end bottom
  ctx.bezierCurveTo(-8, 3.5, -13, 2, -15, 0);
  ctx.closePath();
  ctx.fill();
  
  // Shadow/darker edge on bottom
  ctx.fillStyle = shadowColor;
  ctx.beginPath();
  ctx.moveTo(-14, -1);
  ctx.bezierCurveTo(-8, 2, 3, 3.5, 14, 1.5);
  ctx.bezierCurveTo(8, 3, 0, 3.5, -14, 0.5);
  ctx.closePath();
  ctx.fill();
  
  // Highlight on top
  ctx.fillStyle = highlightColor;
  ctx.beginPath();
  ctx.ellipse(-5, -3, 3, 1.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, -2.5, 4, 1.2, 0.1, 0, Math.PI * 2);
  ctx.fill();
  
  // Stem at left end (top)
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-15, -2);
  ctx.lineTo(-18, -4);
  ctx.stroke();
  
  // Brown spots (only on yellow bananas)
  if (!isGrowing && isBonus) {
    ctx.fillStyle = 'rgba(101, 67, 33, 0.5)';
    ctx.beginPath();
    ctx.ellipse(5, -1, 2, 1.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-5, 0, 1.5, 1, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(10, 0, 1.2, 0.8, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.restore();
}

// Draw obstacles
function drawObstacles() {
  obstacles.forEach(obstacle => {
    const isBonus = obstacle.isBonus && obstacle.hasTransformed;
    const isGrowing = obstacle.isGrowing && obstacle.hasTransformed;
    const scale = obstacle.scale || 1.5;
    const rotation = obstacle.rotation || 0;
    drawBanana(obstacle.x, obstacle.y, obstacle.width, isBonus, isGrowing, scale, rotation);
  });
}

// Draw score
function drawScore() {
  // Flash score red when collecting bonus
  if (scoreFlashTime > 0) {
    ctx.fillStyle = '#FF0000';
    scoreFlashTime--;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${score}`, 10, 30);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`High Score: ${highScore}`, 10, 55);
}

// Draw player
function drawPlayer() {
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  
  // Calculate foot positions based on animation frame
  const footSwing = Math.sin(player.animationFrame) * 8; // Bigger horizontal movement
  const footBob = Math.abs(Math.sin(player.animationFrame)) * 4; // Vertical bob
  const isMoving = player.dx !== 0;
  
  // Draw feet/legs (animated when moving, extended when standing)
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  
  if (isMoving) {
    // Left leg - swings opposite to right
    const leftFootX = player.x + 22 + footSwing;
    const leftFootY = player.y + 42 + footBob;
    ctx.beginPath();
    ctx.moveTo(player.x + 25, player.y + 35);
    ctx.lineTo(leftFootX, leftFootY);
    ctx.stroke();
    
    // Draw foot
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.ellipse(leftFootX, leftFootY, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Right leg - swings opposite to left
    const rightFootX = player.x + 48 - footSwing;
    const rightFootY = player.y + 42 + footBob;
    ctx.beginPath();
    ctx.moveTo(player.x + 45, player.y + 35);
    ctx.lineTo(rightFootX, rightFootY);
    ctx.stroke();
    
    // Draw foot
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.ellipse(rightFootX, rightFootY, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Standing still - legs extended and spread apart
    // Left leg
    ctx.beginPath();
    ctx.moveTo(player.x + 25, player.y + 35);
    ctx.lineTo(player.x + 18, player.y + 45);
    ctx.stroke();
    
    // Draw foot
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.ellipse(player.x + 18, player.y + 45, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Right leg
    ctx.beginPath();
    ctx.moveTo(player.x + 45, player.y + 35);
    ctx.lineTo(player.x + 52, player.y + 45);
    ctx.stroke();
    
    // Draw foot
    ctx.fillStyle = '#654321';
    ctx.beginPath();
    ctx.ellipse(player.x + 52, player.y + 45, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw body (brown rectangle)
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(player.x + 15, player.y + 22, 40, 20);
  
  // Draw head (brown circle)
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.arc(centerX, player.y + 15, 16, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw face (lighter brown)
  ctx.fillStyle = '#D2691E';
  ctx.beginPath();
  ctx.arc(centerX, player.y + 18, 11, 0, Math.PI);
  ctx.fill();
  
  // Draw eyes
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX - 6, player.y + 13, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(centerX + 6, player.y + 13, 3, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw space helmet (transparent dome)
  ctx.strokeStyle = '#87CEEB';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(centerX, player.y + 15, 20, 0, Math.PI * 2);
  ctx.stroke();
  
  // Draw helmet shine
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX - 7, player.y + 8, 5, 0, Math.PI);
  ctx.stroke();
  
  // Draw helmet base/collar
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(player.x + 20, player.y + 33, 30, 4);
  
  // Draw arms
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x + 18, player.y + 26);
  ctx.lineTo(player.x + 8, player.y + 36);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(player.x + 52, player.y + 26);
  ctx.lineTo(player.x + 62, player.y + 36);
  ctx.stroke();
}

// Check collision
function checkCollision() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    
    // Smaller hitbox - add padding to player and obstacle
    const padding = 8;
    const playerHitbox = {
      x: player.x + padding,
      y: player.y + padding,
      width: player.width - padding * 2,
      height: player.height - padding * 2
    };
    
    // Scale the obstacle hitbox if it's growing
    const scale = obstacle.scale || 1.0;
    const scaledWidth = obstacle.width * scale;
    const scaledHeight = obstacle.height * scale;
    const offsetX = (scaledWidth - obstacle.width) / 2;
    const offsetY = (scaledHeight - obstacle.height) / 2;
    
    const obstacleHitbox = {
      x: obstacle.x - offsetX + padding,
      y: obstacle.y - offsetY + padding,
      width: scaledWidth - padding * 2,
      height: scaledHeight - padding * 2
    };
    
    if (playerHitbox.x < obstacleHitbox.x + obstacleHitbox.width &&
        playerHitbox.x + playerHitbox.width > obstacleHitbox.x &&
        playerHitbox.y < obstacleHitbox.y + obstacleHitbox.height &&
        playerHitbox.y + playerHitbox.height > obstacleHitbox.y) {
      
      // Check if it's a yellow ripe banana (edible)
      if (obstacle.isBonus && obstacle.hasTransformed) {
        // Award bonus points
        score += 200;
        scoreFlashTime = 20; // Flash for 20 frames
        
        // Create sparkle effect at banana position
        createBonusEffect(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
        
        obstacles.splice(i, 1); // Remove the bonus banana
        return false; // Not a collision, continue game
      }
      
      return true; // Regular collision
    }
  }
  return false;
}

// Create bonus collection sparkle
function createBonusEffect(x, y) {
  const particleCount = 20;
  
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    const size = Math.random() * 4 + 2;
    
    bonusParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      life: 1.0,
      decay: Math.random() * 0.03 + 0.02,
      color: Math.random() > 0.5 ? '#FFD700' : '#FFA500' // Yellow/gold sparkles
    });
  }
}

// Update bonus particles
function updateBonusParticles() {
  for (let i = bonusParticles.length - 1; i >= 0; i--) {
    const p = bonusParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95; // friction
    p.vy *= 0.95;
    p.life -= p.decay;
    
    if (p.life <= 0) {
      bonusParticles.splice(i, 1);
    }
  }
}

// Draw bonus particles
function drawBonusParticles() {
  bonusParticles.forEach(p => {
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1.0;
}

// Create explosion
function createExplosion(x, y) {
  const particleCount = 60;
  
  // Create different types of particles
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 1;
    const size = Math.random() * 6 + 2;
    
    // Vary colors for more realistic fire/explosion
    const colors = ['#FF4500', '#FF6600', '#FF8C00', '#FFD700', '#FFA500', '#FF0000', '#8B0000'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    explosionParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: size,
      life: 1.0,
      decay: Math.random() * 0.015 + 0.015,
      color: color,
      friction: 0.98
    });
  }
  
  // Add smoke particles
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 2 + 0.5;
    
    explosionParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      size: Math.random() * 8 + 4,
      life: 1.0,
      decay: Math.random() * 0.01 + 0.01,
      color: '#333333',
      friction: 0.95,
      isSmoke: true
    });
  }
}

// Update explosion particles
function updateExplosion() {
  for (let i = explosionParticles.length - 1; i >= 0; i--) {
    const p = explosionParticles[i];
    
    // Apply velocity with friction
    p.vx *= p.friction;
    p.vy *= p.friction;
    
    p.x += p.vx;
    p.y += p.vy;
    
    // Apply gravity (less for smoke)
    if (p.isSmoke) {
      p.vy -= 0.1; // smoke rises
      p.size += 0.2; // smoke expands
    } else {
      p.vy += 0.3; // fire falls
    }
    
    // Fade out
    p.life -= p.decay;
    
    if (p.life <= 0) {
      explosionParticles.splice(i, 1);
    }
  }
}

// Draw explosion particles
function drawExplosion() {
  explosionParticles.forEach(p => {
    ctx.save();
    
    // Add glow effect for fire particles
    if (!p.isSmoke && p.life > 0.5) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
    }
    
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  });
  ctx.globalAlpha = 1.0;
}

// Reset game
function resetGame() {
  player.x = canvas.width / 2 - 35;
  player.dx = 0;
  player.animationFrame = 0;
  obstacles.length = 0;
  frameCount = 0;
  score = 0;
  scoreFlashTime = 0;
  gameOver = false;
  explosionParticles = [];
  bonusParticles = [];
  showGameOverText = false;
  gameLoop();
}

// Draw restart button
function drawRestartButton() {
  const buttonWidth = 250;
  const buttonHeight = 60;
  const buttonX = canvas.width / 2 - buttonWidth / 2;
  const buttonY = canvas.height / 2 + 60;
  
  ctx.fillStyle = '#646cff';
  ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Restart', canvas.width / 2, buttonY + 40);
  
  return { x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight };
}

// Handle click on restart button
canvas.addEventListener('click', (e) => {
  if (!gameOver) return;
  
  const rect = canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
  const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
  
  const buttonWidth = 250;
  const buttonHeight = 60;
  const buttonX = canvas.width / 2 - buttonWidth / 2;
  const buttonY = canvas.height / 2 + 60;
  
  if (clickX >= buttonX && clickX <= buttonX + buttonWidth &&
      clickY >= buttonY && clickY <= buttonY + buttonHeight) {
    resetGame();
  }
});

// Handle touch on restart button for mobile - handled in document touchstart above
// (Removed duplicate listener)

// Clear canvas
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Draw jungle background
function drawJungleBackground() {
  // Sky gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, '#87CEEB');
  skyGradient.addColorStop(1, '#E0F6FF');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw distant trees/foliage
  ctx.fillStyle = '#2d5016';
  for (let i = 0; i < 8; i++) {
    const x = (i * canvas.width / 7) - 20;
    ctx.beginPath();
    ctx.ellipse(x, 40, 60, 80, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw tree trunks in background
  ctx.fillStyle = '#654321';
  for (let i = 0; i < 6; i++) {
    const x = (i * canvas.width / 5);
    ctx.fillRect(x - 8, 0, 16, 120);
  }
  
  // Draw large leaves at top
  ctx.fillStyle = '#228B22';
  for (let i = 0; i < 10; i++) {
    const x = (i * canvas.width / 9);
    const offset = (i % 2) * 30;
    
    // Leaf shape
    ctx.save();
    ctx.translate(x, 20 + offset);
    ctx.rotate(Math.PI / 6 * (i % 3));
    ctx.beginPath();
    ctx.ellipse(0, 0, 40, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  // More foreground leaves
  ctx.fillStyle = '#32CD32';
  for (let i = 0; i < 12; i++) {
    const x = (i * canvas.width / 11) + 20;
    const offset = (i % 3) * 25;
    
    ctx.save();
    ctx.translate(x, 15 + offset);
    ctx.rotate(-Math.PI / 5 * (i % 4));
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  
  // Ground/jungle floor
  ctx.fillStyle = '#1a4d0f';
  ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
  
  // Grass texture on ground
  ctx.strokeStyle = '#228B22';
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * canvas.width;
    const y = canvas.height - 60 + Math.random() * 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 4 - 2, y - 8);
    ctx.stroke();
  }
}

// Game loop
function gameLoop() {
  clearCanvas();
  drawJungleBackground();
  
  if (gameOver) {
    // Continue updating and drawing explosion
    updateExplosion();
    drawObstacles();
    drawExplosion();
    drawScore();
    
    // Show game over text after explosion starts
    if (explosionParticles.length === 0 || showGameOverText) {
      showGameOverText = true;
      ctx.fillStyle = '#ff4444';
      ctx.font = '48px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 40);
      ctx.font = '24px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
      drawRestartButton();
    }
    
    if (explosionParticles.length > 0) {
      requestAnimationFrame(gameLoop);
    }
    return;
  }
  
  updatePlayer();
  updateObstacles();
  updateBonusParticles();
  
  // Check for collision
  if (checkCollision()) {
    gameOver = true;
    
    // Update high score
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('highScore', highScore);
    }
    
    // Create explosion at monkey's position
    createExplosion(player.x + player.width / 2, player.y + player.height / 2);
    requestAnimationFrame(gameLoop);
    return;
  }
  
  drawObstacles();
  drawPlayer();
  drawBonusParticles();
  drawScore();
  requestAnimationFrame(gameLoop);
}

// Start game
gameLoop();
