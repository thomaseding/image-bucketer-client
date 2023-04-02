import axios from "axios";
import { Action } from "./types";

const API_URL = "http://localhost:3000/api";

export async function sendAction(action: Action): Promise<unknown> {
  try {
    const response = await axios.post(API_URL, action);
    return response.data;
  } catch (error) {
    console.error("Error sending action:", error);
    throw error;
  }
}
