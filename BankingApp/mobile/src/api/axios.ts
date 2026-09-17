import axios from "axios";

const api = axios.create({

  // Backend URL
  baseURL: "http://localhost:5000/api/v1",

  headers:{
    "Content-Type":"application/json"
  }

});


export default api;