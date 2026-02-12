
export const fetchIOPaintModels = async (apiUrl: string): Promise<string[]> => {
    try {
        const cleanedUrl = apiUrl.replace(/\/+$/, '');
        // Note: IOPaint API documentation says GET /api/v1/server-config returns modelInfos
        const res = await fetch(`${cleanedUrl}/api/v1/server-config`);
        if (!res.ok) throw new Error("Failed to connect to IOPaint");
        const data = await res.json();
        // data.modelInfos is array of {name: string, ...}
        if (data.modelInfos && Array.isArray(data.modelInfos)) {
            return data.modelInfos.map((m: any) => m.name);
        }
        return ['lama']; // Fallback
    } catch (e) {
        console.warn("Failed to fetch IOPaint models", e);
        return [];
    }
};

export const switchIOPaintModel = async (apiUrl: string, modelName: string) => {
    try {
        const cleanedUrl = apiUrl.replace(/\/+$/, '');
        await fetch(`${cleanedUrl}/api/v1/model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName })
        });
    } catch (e) {
        console.error("Failed to switch model", e);
    }
};

export const inpaintImage = async (
    apiUrl: string, 
    base64Image: string, 
    base64Mask: string,
    modelName?: string
): Promise<string> => {
    const cleanedUrl = apiUrl.replace(/\/+$/, '');
    
    // Ensure model is set (optional, but good practice if model selection is provided)
    if (modelName) {
        await switchIOPaintModel(cleanedUrl, modelName);
    }

    // IOPaint expects standard base64 data URIs
    const payload = {
        image: base64Image.startsWith('data:') ? base64Image : `data:image/png;base64,${base64Image}`,
        mask: base64Mask.startsWith('data:') ? base64Mask : `data:image/png;base64,${base64Mask}`,
        hdStrategy: "ORIGINAL", // Default strategy
        // Optional parameters can be added here based on config if needed
    };

    const response = await fetch(`${cleanedUrl}/api/v1/inpaint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Inpainting failed: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
