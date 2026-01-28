-- NutriCoach Database Schema
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ==============================================================================
-- USER PROFILES
-- ==============================================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    birth_date DATE,
    sex TEXT CHECK (sex IN ('male', 'female')),
    height_cm NUMERIC(5,2),
    current_weight_kg NUMERIC(5,2),
    target_weight_kg NUMERIC(5,2),
    activity_level TEXT DEFAULT 'sedentary' CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal TEXT DEFAULT 'maintain' CHECK (goal IN ('lose_fat', 'maintain', 'gain_muscle')),
    daily_calorie_target INTEGER,
    protein_target_g INTEGER,
    carbs_target_g INTEGER,
    fat_target_g INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- WEIGHT TRACKING
-- ==============================================================================
CREATE TABLE public.weight_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    weight_kg NUMERIC(5,2) NOT NULL,
    notes TEXT,
    recorded_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, recorded_at)
);

-- ==============================================================================
-- RECIPES & INGREDIENTS
-- ==============================================================================
CREATE TABLE public.ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    calories_per_100g NUMERIC(6,2),
    protein_per_100g NUMERIC(5,2),
    carbs_per_100g NUMERIC(5,2),
    fat_per_100g NUMERIC(5,2),
    fiber_per_100g NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER DEFAULT 1,
    calories NUMERIC(6,2),
    protein_g NUMERIC(5,2),
    carbs_g NUMERIC(5,2),
    fat_g NUMERIC(5,2),
    fiber_g NUMERIC(5,2),
    image_url TEXT,
    is_public BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity_g NUMERIC(6,2) NOT NULL,
    notes TEXT,
    UNIQUE(recipe_id, ingredient_id)
);

-- ==============================================================================
-- MEAL PLANNING
-- ==============================================================================
CREATE TYPE meal_type AS ENUM ('breakfast', 'mid_morning', 'lunch', 'snack', 'dinner');

CREATE TABLE public.meal_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

CREATE TABLE public.meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meal_plan_id UUID REFERENCES public.meal_plans(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    meal_type meal_type NOT NULL,
    custom_name TEXT,
    custom_calories NUMERIC(6,2),
    custom_protein_g NUMERIC(5,2),
    custom_carbs_g NUMERIC(5,2),
    custom_fat_g NUMERIC(5,2),
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- SUPERMARKET PRICES
-- ==============================================================================
CREATE TABLE public.supermarkets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    website_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.product_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
    supermarket_id UUID NOT NULL REFERENCES public.supermarkets(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    price NUMERIC(8,2) NOT NULL,
    unit TEXT DEFAULT 'kg',
    price_per_kg NUMERIC(8,2),
    url TEXT,
    image_url TEXT,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- AI CHAT
-- ==============================================================================
CREATE TABLE public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Nueva conversación',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- RAG KNOWLEDGE BASE (pgvector)
-- ==============================================================================
CREATE TABLE public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    source TEXT,
    source_url TEXT,
    content TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX knowledge_documents_embedding_idx ON public.knowledge_documents
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RAG Search Function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    content text,
    source text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kd.id,
        kd.content,
        kd.source,
        1 - (kd.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_documents kd
    WHERE 1 - (kd.embedding <=> query_embedding) > match_threshold
    ORDER BY kd.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ==============================================================================
-- GAMIFICATION
-- ==============================================================================
CREATE TYPE streak_type AS ENUM ('daily_meals', 'weekly_plan', 'weight_log', 'exercise');

CREATE TABLE public.streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type streak_type NOT NULL,
    current_count INTEGER DEFAULT 0,
    longest_count INTEGER DEFAULT 0,
    last_activity_date DATE,
    streak_protection_used BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, type)
);

CREATE TABLE public.achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    condition_type TEXT NOT NULL,
    condition_value INTEGER NOT NULL,
    points INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- ==============================================================================
-- EXERCISE TRACKING
-- ==============================================================================
CREATE TYPE muscle_group AS ENUM ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'full_body', 'cardio');

CREATE TABLE public.exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    muscle_group muscle_group NOT NULL,
    secondary_muscles muscle_group[] DEFAULT '{}',
    met_value NUMERIC(4,2) DEFAULT 5.0,
    difficulty TEXT DEFAULT 'intermediate' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    equipment TEXT[] DEFAULT '{}',
    instructions TEXT[],
    image_url TEXT,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exercise_routines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    difficulty TEXT DEFAULT 'intermediate',
    estimated_duration_minutes INTEGER,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.routine_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routine_id UUID NOT NULL REFERENCES public.exercise_routines(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    sets INTEGER DEFAULT 3,
    reps INTEGER DEFAULT 12,
    rest_seconds INTEGER DEFAULT 60,
    order_index INTEGER NOT NULL,
    notes TEXT
);

CREATE TABLE public.exercise_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    routine_id UUID REFERENCES public.exercise_routines(id) ON DELETE SET NULL,
    date DATE DEFAULT CURRENT_DATE,
    duration_minutes INTEGER,
    calories_burned INTEGER,
    notes TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.exercise_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.exercise_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    sets_completed INTEGER,
    reps_completed INTEGER[],
    weight_kg NUMERIC(5,2)[],
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Weight records policies
CREATE POLICY "Users can manage own weight records" ON public.weight_records
    FOR ALL USING (auth.uid() = user_id);

-- Recipes policies
CREATE POLICY "Users can view own or public recipes" ON public.recipes
    FOR SELECT USING (auth.uid() = user_id OR is_public = true);
CREATE POLICY "Users can manage own recipes" ON public.recipes
    FOR ALL USING (auth.uid() = user_id);

-- Meals policies
CREATE POLICY "Users can manage own meals" ON public.meals
    FOR ALL USING (auth.uid() = user_id);

-- Meal plans policies
CREATE POLICY "Users can manage own meal plans" ON public.meal_plans
    FOR ALL USING (auth.uid() = user_id);

-- Chat policies
CREATE POLICY "Users can manage own conversations" ON public.chat_conversations
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own chat messages" ON public.chat_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert own chat messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT id FROM public.chat_conversations WHERE user_id = auth.uid()
        )
    );

-- Streaks policies
CREATE POLICY "Users can manage own streaks" ON public.streaks
    FOR ALL USING (auth.uid() = user_id);

-- Achievements policies
CREATE POLICY "Users can view own achievements" ON public.user_achievements
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert achievements" ON public.user_achievements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Exercise policies
CREATE POLICY "Users can manage own exercise sessions" ON public.exercise_sessions
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own exercise logs" ON public.exercise_logs
    FOR ALL USING (
        session_id IN (
            SELECT id FROM public.exercise_sessions WHERE user_id = auth.uid()
        )
    );

-- ==============================================================================
-- FUNCTIONS & TRIGGERS
-- ==============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

    -- Initialize streaks
    INSERT INTO public.streaks (user_id, type) VALUES
        (NEW.id, 'daily_meals'),
        (NEW.id, 'weekly_plan'),
        (NEW.id, 'weight_log'),
        (NEW.id, 'exercise');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update profile updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER recipes_updated_at
    BEFORE UPDATE ON public.recipes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER meal_plans_updated_at
    BEFORE UPDATE ON public.meal_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==============================================================================
-- SEED DATA: Achievements
-- ==============================================================================
INSERT INTO public.achievements (name, description, icon, condition_type, condition_value, points) VALUES
    ('Primera comida', 'Registra tu primera comida', '🍽️', 'meals_completed', 1, 10),
    ('Semana completa', 'Completa todas las comidas de una semana', '📅', 'weekly_meals_completed', 35, 50),
    ('Racha de 7 días', 'Mantén una racha de 7 días', '🔥', 'streak_days', 7, 30),
    ('Racha de 30 días', 'Mantén una racha de 30 días', '💪', 'streak_days', 30, 100),
    ('Primer pesaje', 'Registra tu primer peso', '⚖️', 'weight_logs', 1, 10),
    ('Control mensual', 'Registra tu peso durante un mes', '📊', 'weight_logs', 30, 50),
    ('Primera conversación', 'Inicia tu primera conversación con NutriCoach', '💬', 'chat_messages', 1, 10),
    ('Aprendiz curioso', 'Haz 50 preguntas a NutriCoach', '🎓', 'chat_messages', 50, 50),
    ('Chef principiante', 'Crea tu primera receta', '👨‍🍳', 'recipes_created', 1, 20),
    ('Chef experto', 'Crea 10 recetas propias', '🏆', 'recipes_created', 10, 75),
    ('Primer entrenamiento', 'Completa tu primera sesión de ejercicio', '🏃', 'exercise_sessions', 1, 15),
    ('Atleta constante', 'Completa 20 sesiones de ejercicio', '🥇', 'exercise_sessions', 20, 100)
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- SEED DATA: Supermarkets
-- ==============================================================================
INSERT INTO public.supermarkets (name, website_url) VALUES
    ('Mercadona', 'https://www.mercadona.es'),
    ('Carrefour', 'https://www.carrefour.es'),
    ('Lidl', 'https://www.lidl.es'),
    ('Dia', 'https://www.dia.es'),
    ('Alcampo', 'https://www.alcampo.es'),
    ('Eroski', 'https://www.eroski.es')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- SEED DATA: Common Exercises
-- ==============================================================================
INSERT INTO public.exercises (name, description, muscle_group, met_value, difficulty, equipment, instructions) VALUES
    ('Sentadillas', 'Ejercicio compuesto para piernas', 'quadriceps', 5.0, 'beginner', '{}', ARRAY['Pies a la anchura de hombros', 'Baja como si te sentaras', 'Mantén la espalda recta', 'Sube hasta posición inicial']),
    ('Flexiones', 'Ejercicio para pecho y tríceps', 'chest', 3.8, 'beginner', '{}', ARRAY['Manos a la anchura de hombros', 'Cuerpo recto como tabla', 'Baja el pecho al suelo', 'Empuja hacia arriba']),
    ('Plancha', 'Ejercicio isométrico de core', 'core', 3.0, 'beginner', '{}', ARRAY['Antebrazos en el suelo', 'Cuerpo recto', 'Aprieta abdomen y glúteos', 'Mantén la posición']),
    ('Burpees', 'Ejercicio cardiovascular completo', 'full_body', 8.0, 'intermediate', '{}', ARRAY['Posición de pie', 'Baja a sentadilla', 'Salta a plancha', 'Flexión', 'Salta de vuelta', 'Salto vertical']),
    ('Dominadas', 'Ejercicio de tracción para espalda', 'back', 6.0, 'advanced', ARRAY['Barra de dominadas'], ARRAY['Agarra la barra', 'Cuelga con brazos extendidos', 'Tira hacia arriba', 'Barbilla sobre la barra']),
    ('Peso muerto', 'Ejercicio compuesto para cadena posterior', 'hamstrings', 6.0, 'intermediate', ARRAY['Barra', 'Discos'], ARRAY['Pies anchura de cadera', 'Agarra la barra', 'Espalda recta', 'Empuja cadera hacia atrás', 'Levanta usando glúteos y piernas']),
    ('Press de banca', 'Ejercicio de empuje para pecho', 'chest', 5.0, 'intermediate', ARRAY['Banco', 'Barra', 'Discos'], ARRAY['Acostado en banco', 'Agarra la barra', 'Baja al pecho', 'Empuja hacia arriba']),
    ('Zancadas', 'Ejercicio unilateral de piernas', 'quadriceps', 4.0, 'beginner', '{}', ARRAY['De pie', 'Da un paso adelante', 'Baja rodilla trasera', 'Empuja para volver', 'Alterna piernas']),
    ('Remo con mancuerna', 'Ejercicio de tracción para espalda', 'back', 4.0, 'beginner', ARRAY['Mancuerna', 'Banco'], ARRAY['Una rodilla en banco', 'Espalda paralela al suelo', 'Tira mancuerna hacia cadera', 'Baja controladamente']),
    ('Correr', 'Ejercicio cardiovascular', 'cardio', 9.8, 'beginner', '{}', ARRAY['Ritmo constante', 'Respiración controlada', 'Pasos cortos y rápidos'])
ON CONFLICT DO NOTHING;
