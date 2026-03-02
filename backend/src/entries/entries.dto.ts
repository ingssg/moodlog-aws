import { IsString, IsNotEmpty, IsDateString, IsOptional, IsIn, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEntryDto {
  @IsIn(['happy', 'neutral', 'sad', 'angry', 'love'])
  mood!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  skip_ai?: boolean;
}

export class GetEntriesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['happy', 'neutral', 'sad', 'angry', 'love'])
  mood?: string;
}

export class DemoEntryDto {
  @IsIn(['happy', 'neutral', 'sad', 'angry', 'love'])
  mood!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
