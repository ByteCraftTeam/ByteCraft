<template>
  <div class="cyber-container">
    <h1 class="cyber-title">SKILLS_MATRIX</h1>
    <div class="cyber-skills">
      <div class="skill-category" v-for="category in skills" :key="category.name">
        <h3 class="skill-category-title">{{ category.name }}</h3>
        <div class="skill-items">
          <div class="skill-item" v-for="skill in category.items" :key="skill.name">
            <span class="skill-name">{{ skill.name }}</span>
            <div class="skill-level">
              <div class="skill-level-bar" :style="{ width: skill.level + '%' }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Skills',
  data() {
    return {
      skills: [
        {
          name: 'FRONTEND',
          items: [
            { name: 'Vue.js', level: 90 },
            { name: 'React', level: 80 }
          ]
        },
        {
          name: 'BACKEND',
          items: [
            { name: 'Node.js', level: 85 },
            { name: 'Python', level: 75 }
          ]
        }
      ]
    }
  }
}
</script>

<style scoped>
.cyber-skills {
  margin-top: 2rem;
}
.skill-category {
  margin-bottom: 2rem;
}
.skill-category-title {
  color: #00ff41;
  margin-bottom: 1rem;
}
.skill-items {
  display: grid;
  gap: 1rem;
}
.skill-item {
  display: flex;
  align-items: center;
}
.skill-name {
  width: 120px;
  color: #00ff88;
}
.skill-level {
  flex: 1;
  height: 10px;
  background-color: #003300;
  position: relative;
}
.skill-level-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background-color: #00ff41;
  box-shadow: 0 0 5px #00ff41;
}
</style>