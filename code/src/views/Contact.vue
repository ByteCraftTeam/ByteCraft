<template>
  <div class="cyber-container">
    <h1 class="cyber-title">CONTACT_ME</h1>
    <div class="cyber-contact">
      <div class="contact-method" v-for="method in contactMethods" :key="method.name">
        <h3 class="contact-method-title">{{ method.name }}</h3>
        <p class="contact-method-value">{{ method.value }}</p>
      </div>
    </div>
    <div class="cyber-form">
      <h3 class="form-title">SEND_MESSAGE</h3>
      <form>
        <div class="form-group">
          <label>NAME</label>
          <input type="text" class="cyber-input">
        </div>
        <div class="form-group">
          <label>EMAIL</label>
          <input type="email" class="cyber-input">
        </div>
        <div class="form-group">
          <label>MESSAGE</label>
          <textarea class="cyber-textarea"></textarea>
        </div>
        <button type="submit" class="cyber-button">SEND</button>
      </form>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Contact',
  data() {
    return {
      contactMethods: [
        { name: 'EMAIL', value: 'contact@example.com' },
        { name: 'GITHUB', value: 'github.com/username' },
        { name: 'LINKEDIN', value: 'linkedin.com/in/username' }
      ]
    }
  }
}
</script>

<style scoped>
.cyber-contact {
  margin-bottom: 3rem;
}
.contact-method {
  margin-bottom: 1.5rem;
}
.contact-method-title {
  color: #00ff41;
  margin-bottom: 0.5rem;
}
.contact-method-value {
  color: #00ff88;
}
.cyber-form {
  max-width: 600px;
}
.form-title {
  color: #00ff41;
  margin-bottom: 1.5rem;
}
.form-group {
  margin-bottom: 1.5rem;
}
.cyber-input, .cyber-textarea {
  width: 100%;
  padding: 0.8rem;
  background-color: #0a0a12;
  border: 1px solid #00ff41;
  color: #00ff88;
}
.cyber-textarea {
  min-height: 150px;
}
.cyber-button {
  padding: 0.8rem 2rem;
  background-color: #003300;
  color: #00ff41;
  border: 1px solid #00ff41;
  cursor: pointer;
  transition: all 0.3s;
}
.cyber-button:hover {
  background-color: #00ff41;
  color: #0a0a12;
}
</style>