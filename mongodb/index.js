import mongoose from 'mongoose';
import { connectDB } from './db.js';

const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
  email: String,
});

const User = mongoose.model('User', userSchema);

await connectDB();

// CREATE
await User.create({ name: '철수', age: 20, email: 'chulsoo@example.com' });

// SELECT
const users = await User.find();
console.log('📋 Users:', users);

// UPDATE
await User.updateOne({ name: '철수' }, { age: 21 });

// DELETE
// await User.deleteOne({ name: '철수' });

process.exit();
