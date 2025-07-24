const request = require('supertest');
const app = require('../index');

describe('GET /', () => {
  it('should respond with a greeting message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('Hello, Credverse Scaffold!');
  });
});
