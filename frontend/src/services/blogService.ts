import axios from "axios";
import Cookies from "js-cookie";

const API_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000") + "/api/blog";

const getAuthHeaders = () => {
    const token = Cookies.get("token");
    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};

export interface Section {
    id: string;
    heading?: string;
    content: string;
    image?: string;
    order: number;
}

export interface Post {
    id: number;
    title: string;
    slug: string;
    description?: string;
    author_id: number;
    tags: string[];
    cover_image?: string;
    sections: Section[];
    created_at: string;
    updated_at: string;
}

export const BlogService = {
    getAllPosts: async (page = 1, limit = 10, search?: string, tag?: string) => {
        const params: any = { page, limit };
        if (search) params.search = search;
        if (tag) params.tag = tag;
        const response = await axios.get(API_URL, { params });
        return response.data;
    },

    getPostBySlug: async (slug: string) => {
        const response = await axios.get(`${API_URL}/${slug}`);
        return response.data;
    },

    createPost: async (postData: Partial<Post>) => {
        const response = await axios.post(API_URL, postData, getAuthHeaders());
        return response.data;
    },

    updatePost: async (id: number, postData: Partial<Post>) => {
        const response = await axios.put(`${API_URL}/${id}`, postData, getAuthHeaders());
        return response.data;
    },

    deletePost: async (id: number) => {
        const response = await axios.delete(`${API_URL}/${id}`, getAuthHeaders());
        return response.data;
    },

    getMyPosts: async (page = 1, limit = 10) => {
        const response = await axios.get(`${API_URL}/mine`, {
            ...getAuthHeaders(),
            params: { page, limit }
        });
        return response.data;
    }
};
