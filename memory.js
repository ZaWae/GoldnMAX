class GoldnMemory {
    static KEY = "goldn_max_memory_v1";

    static load() {
        try {
            const data = localStorage.getItem(GoldnMemory.KEY);
            return data ? JSON.parse(data) : { facts: [] };
        } catch (e) {
            console.error("Error loading memory", e);
            return { facts: [] };
        }
    }

    static save(memory) {
        try {
            localStorage.setItem(GoldnMemory.KEY, JSON.stringify(memory));
        } catch (e) {
            console.error("Error saving memory", e);
        }
    }

    static remember(text) {
        const trimmed = text.trim();
        if (!trimmed) return;
        let memory = GoldnMemory.load();
        memory.facts.push(trimmed);
        GoldnMemory.save(memory);
    }

    static recall() {
        const m = GoldnMemory.load();
        if (!m.facts.length) return "No stored memories yet.";
        return m.facts.join("\n- ");
    }
}
