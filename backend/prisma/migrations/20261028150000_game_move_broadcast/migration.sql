CREATE OR REPLACE FUNCTION public.is_game_participant_for_realtime_topic(requested_topic text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public."Game" AS game
    WHERE requested_topic = 'game:' || game.id::text
      AND (
        game."whitePlayerId" = auth.uid()
        OR game."blackPlayerId" = auth.uid()
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.is_game_participant_for_realtime_topic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_game_participant_for_realtime_topic(text) TO authenticated;

CREATE POLICY "Game participants can receive game move broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'broadcast'
  AND public.is_game_participant_for_realtime_topic(realtime.topic())
);

CREATE POLICY "Game participants can send game move broadcasts"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'broadcast'
  AND public.is_game_participant_for_realtime_topic(realtime.topic())
);
