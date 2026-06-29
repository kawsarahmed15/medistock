import ky from 'ky';
(async () => {
  try {
    // 1. login to get token
    const loginRes = await ky.post('http://127.0.0.1:4000/api/auth/login', {
      json: { email: 'zafarmohammadekbal@gmail.com', password: 'password' }
    });
    // This probably will fail since we don't know the password.
    console.log(loginRes.status);
  } catch (err) {
    console.error(err);
  }
})();
